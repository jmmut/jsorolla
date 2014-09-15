/*
 * Copyright (c) 2012 Francisco Salavert (ICM-CIPF)
 * Copyright (c) 2012 Ruben Sanchez (ICM-CIPF)
 * Copyright (c) 2012 Ignacio Medina (ICM-CIPF)
 *
 * This file is part of JS Common Libs.
 *
 * JS Common Libs is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * JS Common Libs is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with JS Common Libs. If not, see <http://www.gnu.org/licenses/>.
 */

function CellBaseAdapter(args) {

    _.extend(this, Backbone.Events);

    this.host;
    this.version;

    _.extend(this, args);

    this.on(this.handlers);

    this.cache = {};
}

CellBaseAdapter.prototype = {

    getData: function (args) {
        var _this = this;

        args.webServiceCallCount = 0;

        /** Check region and parameters **/
        var region = args.region;
        if (region.start > 300000000 || region.end < 1) {
            return;
        }
        region.start = (region.start < 1) ? 1 : region.start;
        region.end = (region.end > 300000000) ? 300000000 : region.end;


        var params = {};
        _.extend(params, this.params);
        _.extend(params, args.params);

        var dataType = args.dataType;
        if (_.isUndefined(dataType)) {
            console.log("dataType must be provided!!!");
        }
        var chunkSize;

        // two levels of cache. In this adapter, default are: species and type of track.
        this.cacheConfig.cacheId = (this.species.text + this.species.assembly).replace(/[/_().\ -]/g, '');
        this.cacheConfig.subCacheId = this.resource + this.params.exclude;
        var combinedCacheId = _this.cacheConfig.cacheId + "_" + _this.cacheConfig.subCacheId;

        /** Check dataType histogram  **/
        if (dataType == 'histogram') {
            // Histogram chunks will be saved in different caches by interval size
            // The chunkSize will be the histogram interval
            var histogramId = dataType + params.interval;

            if (_.isUndefined(this.cache[combinedCacheId])) {
                this.cache[combinedCacheId] = new FeatureChunkCache(_.extend({chunkSize: params.interval}, _this.cacheConfig));
            }
            chunkSize = this.cache[combinedCacheId].chunkSize;

            // Extend region to be adjusted with the chunks
            //        --------------------             -> Region needed
            // |----|----|----|----|----|----|----|    -> Logical chunk division
            //      |----|----|----|----|----|         -> Chunks covered by needed region
            //      |------------------------|         -> Adjusted region
            this.cache[combinedCacheId].getAdjustedRegions(region, function (adjustedRegions) {

                if (adjustedRegions.length > 0) {
                    args.webServiceCallCount++;
                    // Get CellBase data
                    CellBaseManager.get({
                        host: _this.host,
                        version: _this.version,
                        species: _this.species,
                        category: _this.category,
                        subCategory: _this.subCategory,
                        query: adjustedRegions,
                        resource: _this.resource,
                        params: params,
                        success: function (data) {
                            _this._cellbaseHistogramSuccess(data, dataType, combinedCacheId, histogramId, args);
                        }
                    });
                }

                // Get chunks from cache
                _this.cache[combinedCacheId].getByRegion(region, function (cachedChunks) {
                    var decryptedChunks = _this._decryptChunks(cachedChunks, "mypassword");
                    _this.trigger('data:ready', {items: decryptedChunks, dataType: dataType, chunkSize: chunkSize, sender: _this});
                    if (args.webServiceCallCount === 0) {
                        args.done();
                    }
                }, histogramId);
            }, histogramId);

            /** Features: genes, snps ... **/
        } else {
            // Features will be saved using the dataType features
            if (_.isUndefined(this.cache[combinedCacheId])) {
                this.cache[combinedCacheId] = new FeatureChunkCache(this.cacheConfig);
            }
            chunkSize = this.cache[combinedCacheId].chunkSize;

            // Get cached chunks and not cached chunk regions
            //        --------------------             -> Region needed
            // |----|----|----|----|----|----|----|    -> Logical chunk division
            //      |----|----|----|----|----|         -> Chunks covered by needed region
            //      |----|++++|++++|----|----|         -> + means the chunk is cached so its region will not be retrieved
            this.cache[combinedCacheId].getCachedByRegion(region, function (chunksByRegion) {
                if (chunksByRegion.notCached.length > 0) {
                    var queryRegionStrings = _.map(chunksByRegion.notCached, function (region) {
                        return new Region(region).toString();
                    });

                    // Multiple CellBase calls will be performed, each one will
                    // query 50 or less chunk regions
                    var n = 50;
                    var lists = _.groupBy(queryRegionStrings, function (a, b) {
                        return Math.floor(b / n);
                    });
                    // Each element on queriesList contains and array of 50 or less regions
                    var queriesList = _.toArray(lists); //Added this to convert the returned object to an array.

                    for (var i = 0; i < queriesList.length; i++) {
                        args.webServiceCallCount++;
                        CellBaseManager.get({
                            host: _this.host,
                            version: _this.version,
                            species: _this.species,
                            category: _this.category,
                            subCategory: _this.subCategory,
                            query: queriesList[i],
                            resource: _this.resource,
                            params: params,
                            success: function (data) {
                                _this._cellbaseSuccess(data, dataType, combinedCacheId, args);
                            }
                        });
                    }
                }

                // Get chunks from cache
                if (chunksByRegion.cached.length > 0) {
                    _this.cache[combinedCacheId].getByRegions(chunksByRegion.cached, function (cachedChunks) {
                        var decryptedChunks = _this._decryptChunks(cachedChunks, "mypassword");
                        _this.trigger('data:ready', {items: decryptedChunks, dataType: dataType, chunkSize: chunkSize, sender: _this});
                        if (args.webServiceCallCount === 0) {
                            args.done();
                        }
                    });
                }
            });
        }
    },

    _cellbaseSuccess: function (data, dataType, combinedCacheId, args) {
        args.webServiceCallCount--;
        var timeId = this.resource + " save " + Utils.randomString(4);
        console.time(timeId);
        /** time log **/

        var chunkSize = this.cache[combinedCacheId].chunkSize;

        var regions = [];
        var chunks = [];
        for (var i = 0; i < data.response.length; i++) {
            var queryResult = data.response[i];

            regions.push(new Region(queryResult.id));
            chunks.push(queryResult.result);
        }

        var items = this.cache[combinedCacheId].putByRegions(regions, this._encryptChunks(chunks, "mypassword"), true);
        var decItems = this._decryptChunks(items, "mypassword");
        /** time log **/
        console.timeEnd(timeId);

        if (chunks.length > 0) {
            this.trigger('data:ready', {items: decItems, dataType: dataType, chunkSize: chunkSize, sender: this});
        }
        if (args.webServiceCallCount === 0) {
            args.done();
        }


    },
    _cellbaseHistogramSuccess: function (data, dataType, combinedCacheId, histogramId, args) {
        args.webServiceCallCount--;
        var timeId = Utils.randomString(4);
        console.time(this.resource + " save " + timeId);
        /** time log **/

        var chunkSize = this.cache[combinedCacheId].chunkSize;

        var regions = [];
        var chunks = [];
        for (var i = 0; i < data.response.length; i++) {
            var queryResult = data.response[i];
            for (var j = 0; j < queryResult.result.length; j++) {
                var interval = queryResult.result[j];
                var region = new Region(interval);
                regions.push(region);
                chunks.push(interval);
            }
        }
        var items = this.cache[combinedCacheId].putByRegions(regions, this._encryptChunks(chunks, "mypassword"), true, histogramId); // TODO remove "histogram" from "_histogram_<interval>"
        var decItems = this._decryptChunks(items, "mypassword");

        this.trigger('data:ready', {items: decItems, dataType: dataType, chunkSize: chunkSize, sender: this});
        if (args.webServiceCallCount === 0) {
            args.done();
        }
    },

    _decryptChunks: function (chunks, password) {
        var decryptedChunks = [];
        for (var i = 0; i < chunks.length; i++) {
            if (chunks[i].enc == true) {
                var decrypt = CryptoJS.AES.decrypt(chunks[i].value, password, {format: JsonFormatter});
                decryptedChunks.push({chunkKey: chunks[i].chunkKey, value: JSON.parse(decrypt.toString(CryptoJS.enc.Utf8))});
            } else {
                decryptedChunks.push(chunks);
            }
        }
        return decryptedChunks;
    },

    _encryptChunks: function (chunks, password) {
        var encryptedChunks = [];

        for (var i = 0; i < chunks.length; i++) {
            var message = JSON.stringify(chunks[i]);
            var encr = CryptoJS.AES.encrypt(message, password, {format: JsonFormatter});
            encryptedChunks.push(encr.toString());
//            encryptedChunks.push(encr);
//            encryptedChunks.push(chunks[i]);
        }
        return encryptedChunks;
    }

};

var JsonFormatter = {
    stringify: function (cipherParams) {
        // create json object with ciphertext
        var jsonObj = {
            ct: cipherParams.ciphertext.toString(CryptoJS.enc.Base64)
        };

        // optionally add iv and salt
        if (cipherParams.iv) {
            jsonObj.iv = cipherParams.iv.toString();
        }
        if (cipherParams.salt) {
            jsonObj.s = cipherParams.salt.toString();
        }

        // stringify json object
        return JSON.stringify(jsonObj);
    },

    parse: function (jsonStr) {
        // parse json string
        var jsonObj = JSON.parse(jsonStr);

        // extract ciphertext from json object, and create cipher params object
        var cipherParams = CryptoJS.lib.CipherParams.create({
            ciphertext: CryptoJS.enc.Base64.parse(jsonObj.ct)
        });

        // optionally extract iv and salt
        if (jsonObj.iv) {
            cipherParams.iv = CryptoJS.enc.Hex.parse(jsonObj.iv)
        }
        if (jsonObj.s) {
            cipherParams.salt = CryptoJS.enc.Hex.parse(jsonObj.s)
        }

        return cipherParams;
    }
};
