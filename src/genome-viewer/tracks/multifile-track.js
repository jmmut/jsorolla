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

MultifileTrack.prototype = new Track({});

function MultifileTrack(args) {
    Track.call(this, args);

    // Using Underscore 'extend' function to extend and add Backbone Events
    _.extend(this, Backbone.Events);

    //set default args
    this.ALIGNMENT_FEATURE = 'alignments';
    this.VARIANT_FEATURE = 'variants';

    //save default render reference;
    this.defaultRenderer = this.renderer;   // TODO deprecated?
//    this.histogramRenderer = new FeatureClusterRenderer();
    var histogramArgs = _.extend({}, args);
    this.histogramRenderer = new HistogramRenderer(_.extend(histogramArgs, {histogramMaxFreqValue: 200,
        height: args.height/args.files.length}));

    this.featureType = 'Feature';
    this.files = [];
    //set instantiation args, must be last
    _.extend(this, args);

    this.renderers = {};
    for (var i = 0; i < this.featureTypes.length; i++) {
        if (this.featureTypes[i] == this.ALIGNMENT_FEATURE && this.alignmentRenderer) {
            this.renderers[this.files[i]] = this.alignmentRenderer;
        } else if (this.featureTypes[i] == this.VARIANT_FEATURE && this.variantRenderer) {
            this.renderers[this.files[i]] = this.variantRenderer;
        } else {
            this.renderers[this.files[i]] = null;
            console.log("no renderer provided for file " + this.files[i]);
        }
    }

    this.resource = this.dataAdapter.resource;
    this.species = this.dataAdapter.species;

    this.dataType = 'features';

    this.fileDivs = {};   // <this.files.length> children of contentdiv.
    this.fileMainSvgs = {};   // bijection 1 to 1 with fileDivs
    this.svgGroups = {};    // wrapper of renderer-related internal svgs.
    // TODO this.renderer.setfiles(this.files);

    this.chunksDisplayed = new FeatureChunkCache({storeType: "MemoryStore"});
};

MultifileTrack.prototype.updateHeight = function () {
    //TODO if needed

    $(this.contentDiv).css({'height': this.height});
    var fileHeight = this.height/this.files.length;

    if (this.histogram) {
        for (var j = 0; j < this.files.length; j++) {
            var file = this.files[j];
//        $(this.contentDiv).css({'height': this.histogramRenderer.histogramHeight + 5});
            $(this.fileDivs[file]).css({'height': fileHeight});
            this.fileMainSvgs[file].setAttribute('height', this.histogramRenderer.histogramHeight);
            this.svgGroups[file].setAttribute('height', this.histogramRenderer.histogramHeight);
        }
        return;
    }

    for (var j = 0; j < this.files.length; j++) {
        var file = this.files[j];
        $(this.fileDivs[file]).css({'height': fileHeight});
        // TODO this.fileMainSvgs[file].height = fileHeight;
        var renderedHeight = this.svgGroups[file].getBoundingClientRect().height;
        this.fileMainSvgs[file].setAttribute('height', renderedHeight);
    }


    if (this.resizable) {
        if (this.autoHeight == true) {
            var heightSum = 0;
            for (var k = 0; k < this.files.length; k++) {
                var file = this.files[k];
                /*
                var x = this.pixelPosition;
                var width = this.width;
                var lastContains = 0;
                for (var i in this.renderedArea[file]) {
                    if (this.renderedArea[file][i].contains({start: x, end: x + width })) {
                        lastContains = k;
                    }
                }
                var visibleHeight = parseInt(lastContains) + 30;
//                this.fileMainSvgs[file].setAttribute('height', visibleHeight);
                heightSum += visibleHeight;
                */

                var renderedHeight = this.svgGroups[file].getBoundingClientRect().height;
                if (renderedHeight > 200) {
                    renderedHeight = 200;
                }
                $(this.fileDivs[file]).css({'height': renderedHeight});
                heightSum += renderedHeight;

            }
            $(this.contentDiv).css({'height': heightSum + 5});
        }
    }

//    this._updateHeight();

};

MultifileTrack.prototype.clean = function () {
//    this._clean();

    this.chunksDisplayed = new FeatureChunkCache({storeType: "MemoryStore"});
    this.renderedArea = {};

//    console.time("-----------------------------------------empty");
    for (var i = 0; i < this.files.length; i++) {
        var svgCanvasFeatures = this.svgGroups[this.files[i]];
        while (svgCanvasFeatures.firstChild) {
            svgCanvasFeatures.removeChild(svgCanvasFeatures.firstChild);
        }
        this.renderedArea[this.files[i]] = {};

        if (this.renderers[this.files[i]]) {
            this.renderers[this.files[i]].init(svgCanvasFeatures, this.files[i]);
        }
    }
//    console.timeEnd("-----------------------------------------empty");
};

MultifileTrack.prototype.render = function (targetId) {
    var _this = this;
    this.initializeDom(targetId);

//    this.contentDiv; //TODO create custom dom structure inside

    var fileHeight = this.height/this.files.length;
    for (var i = 0; i < this.files.length; i++) {
        var file = this.files[i];
//        this.fileDivs[file] = $('<div id="' + file + '-svgdiv" style="height:' + fileHeight + 'px"></div>')[0];
        _this.fileDivs[file] = $('<div id="' + file + '-svgdiv" style="overflow-y: scroll"></div>')[0];

        // TODO test $(this.contentDiv).css({'height': this.height});
        $(_this.contentDiv).append(_this.fileDivs[file]);

        _this.fileMainSvgs[file] = SVG.addChild(_this.fileDivs[file], 'svg', {
            'class': 'fileMainSvg',
            'x': 0,
            'y': 0,
            'width': this.width,
            'height': fileHeight
        });
        /* Internal svg structure */
        _this.svgGroups[file] = SVG.addChild(_this.fileMainSvgs[file], 'svg', {
            'class': 'svgGroup',
            'x': -_this.pixelPosition,
            'width': _this.svgCanvasWidth,
            'overflow': 'auto'
//            'height': fileHeight
        });
        _this.renderers[file].init(_this.svgGroups[file], file);
    }

    this.svgCanvasOffset = (this.width * 3 / 2) / this.pixelBase;
    this.svgCanvasLeftLimit = this.region.start - this.svgCanvasOffset * 2;
    this.svgCanvasRightLimit = this.region.start + this.svgCanvasOffset * 2;
    this.updateHeight();
};

MultifileTrack.prototype.draw = function () {
    var _this = this;

    this.svgCanvasOffset = (this.width * 3 / 2) / this.pixelBase;
    this.svgCanvasLeftLimit = this.region.start - this.svgCanvasOffset * 2;
    this.svgCanvasRightLimit = this.region.start + this.svgCanvasOffset * 2;

    this.updateHistogramParams();
    this.clean();

    this.dataType = 'features';
    if (this.histogram) {
        this.dataType = 'histogram';
    }


    if (typeof this.visibleRegionSize === 'undefined' || this.region.length() < this.visibleRegionSize) {
        this.setLoading(true);
        this.dataAdapter.getData({
            categories: this.files,
            dataType: this.dataType,
            region: new Region({
                chromosome: this.region.chromosome,
                start: this.region.start - this.svgCanvasOffset * 2,
                end: this.region.end + this.svgCanvasOffset * 2
            }),
            params: {
                histogram: this.histogram,
                histogramLogarithm: this.histogramLogarithm,
                histogramMax: this.histogramMax,
                interval: this.interval
            },
            done: function () {
                _this.setLoading(false);
            },
            dataReady: function (args) {
                _this.dataReady(args);
            }
        });

//        this.invalidZoomText.setAttribute("visibility", "hidden");
    } else {
        this.invalidZoomText.setAttribute("visibility", "visible");
    }
};


MultifileTrack.prototype.move = function (disp) {
    var _this = this;

    this.dataType = 'features';
    if (this.histogram) {
        this.dataType = 'histogram';
    }

    _this.region.center();
    var pixelDisplacement = disp * _this.pixelBase;
    this.pixelPosition -= pixelDisplacement;

    for (var file in this.svgGroups) {
        //parseFloat important
        var move = parseFloat(this.svgGroups[file].getAttribute("x")) + pixelDisplacement;
        this.svgGroups[file].setAttribute("x", move);
    }

    var virtualStart = parseInt(this.region.start - this.svgCanvasOffset);
    var virtualEnd = parseInt(this.region.end + this.svgCanvasOffset);

    if (typeof this.visibleRegionSize === 'undefined' || this.region.length() < this.visibleRegionSize) {

        if (disp > 0 && virtualStart < this.svgCanvasLeftLimit) {
            this.dataAdapter.getData({
                categories: this.files,
                dataType: this.dataType,
                region: new Region({
                    chromosome: _this.region.chromosome,
                    start: parseInt(this.svgCanvasLeftLimit - this.svgCanvasOffset),
                    end: this.svgCanvasLeftLimit
                }),
                params: {
                    histogram: this.histogram,
                    histogramLogarithm: this.histogramLogarithm,
                    histogramMax: this.histogramMax,
                    interval: this.interval
                },
                done: function () {
                },
                dataReady: function (args) {
                    _this.dataReady(args);
                }
            });
            this.svgCanvasLeftLimit = parseInt(this.svgCanvasLeftLimit - this.svgCanvasOffset);
        }

        if (disp < 0 && virtualEnd > this.svgCanvasRightLimit) {
            this.dataAdapter.getData({
                categories: this.files,
                dataType: this.dataType,
                region: new Region({
                    chromosome: _this.region.chromosome,
                    start: this.svgCanvasRightLimit,
                    end: parseInt(this.svgCanvasRightLimit + this.svgCanvasOffset)
                }),
                params: {
                    histogram: this.histogram,
                    histogramLogarithm: this.histogramLogarithm,
                    histogramMax: this.histogramMax,
                    interval: this.interval
                },
                done: function () {
                },
                dataReady: function (args) {
                    _this.dataReady(args);
                }
            });
            this.svgCanvasRightLimit = parseInt(this.svgCanvasRightLimit + this.svgCanvasOffset);
        }

    }

};

MultifileTrack.prototype.dataReady = function (response) {
    var _this = this;
    var features;
    if (response.dataType == 'histogram') {
        _this.renderer = _this.histogramRenderer;
        features = response.items;
//        debugger
    } else {
        _this.renderer = _this.renderers[response.category];
        // debugger
        features = _this.getFeaturesToRenderByChunk(response);
    }
//    console.log(response);
//    response.items = features;    // why not?
//    _this.renderer.render(response, {
    _this.renderer.render(features, {
        svgCanvasFeatures: _this.svgGroups[response.category],
        featureTypes: _this.featureTypes,   // FIXME
        renderedArea: _this.renderedArea[response.category],
        pixelBase: _this.pixelBase,
        position: _this.region.center(),
        regionSize: _this.region.length(),
        maxLabelRegionSize: _this.maxLabelRegionSize,
        width: _this.width,
        pixelPosition: _this.pixelPosition,
        resource: _this.resource,
        species: _this.species,
        featureType: _this.featureType, // FIXME
        file: response.category
//        height: _this.fileDivs[response.category].offsetHeight
        //, params: response.params
    });
    _this.updateHeight();
};



MultifileTrack.prototype.getFeaturesToRenderByChunk = function(response) {
    var _this = this;

    var chunks = response.items;
    var chunksToRender = [];//Returns an array avoiding already drawn features in this.chunksDisplayed
    var features, feature, displayed, keys = [];

    for (var j = 0; j < chunks.length; j++) {
        keys.push(chunks[j].chunkKey);
    }

    _this.chunksDisplayed.foreachChunk(response.category, keys, function (value, key, iteration) {
        if (value == undefined || value.value != true) {//check if the chunk is already displayed and skip it
            features = [];
            var featuresArray = chunks[iteration].value.alignments ? chunks[iteration].value.alignments : chunks[iteration].value;
            for (var j = 0, lenj = featuresArray.length; j < lenj; j++) {
                feature = featuresArray[j];
//                    for (var j = 0, lenj = chunks[iteration].value.alignments.length; j < lenj; j++) {
//                        feature = chunks[iteration].value.alignments[j];
                var region = new Region(feature);
                displayed = false;

                _this.chunksDisplayed.get(region, [response.category], response.dataType, response.chunkSize, function (cached, uncached) {
                    for (var k = 0; k < cached[response.category].length; k++) {   // check if the feature is in any already displayed chunk
                        if (cached[response.category][k].value == true) {
                            displayed = true;
                            break;
                        }
                    }
                    if (!displayed) {
                        features.push(feature);
                    }
                });
            }

            _this.chunksDisplayed.putChunks([chunks[iteration].chunkKey], [true], response.category);   // mark it as displayed
//                    chunks[iteration].value.alignments = features;
            if (chunks[iteration].value.alignments) {
                chunks[iteration].value.alignments = features;
            } else {
                chunks[iteration].value = features;
            }
            chunksToRender.push(chunks[iteration].value); // add to chunks to render
        }
    });

    return chunksToRender;
};

/*
MultifileTrack.prototype.getFeaturesToRenderByChunk = function(response) {
    var _this = this;

    var chunks = response.items;
    var chunksToRender = [];//Returns an array avoiding already drawn features in this.chunksDisplayed
    var features, feature, displayed;

    for (var i = 0, leni = chunks.length; i < leni; i++) {  // for each chunk
        _this.chunksDisplayed.getChunks(response.category, [chunks[i].chunkKey], function (iteration) {
            return function (values) {
                if (values[0] == undefined || values[0].value != true) {//check if the chunk is already displayed and skip it
                    features = [];
                    var featuresArray = chunks[iteration].value.alignments? chunks[iteration].value.alignments : chunks[iteration].value;
                    for (var j = 0, lenj = featuresArray.length; j < lenj; j++) {
                        feature = featuresArray[j];
//                    for (var j = 0, lenj = chunks[iteration].value.alignments.length; j < lenj; j++) {
//                        feature = chunks[iteration].value.alignments[j];
                        var region = new Region(feature);
                        displayed = false;

                        _this.chunksDisplayed.get(region, [response.category], response.dataType, response.chunkSize, function (cached, uncached) {
                            for (var k = 0; k < cached[response.category].length; k++) {   // check if the feature is in any already displayed chunk
                                if (cached[response.category][k].value == true) {
                                    displayed = true;
                                    break;
                                }
                            }
                            if (!displayed) {
                                features.push(feature);
                            }
                        });
                    }

                    _this.chunksDisplayed.putChunks([chunks[iteration].chunkKey], [true], response.category);   // mark it as displayed
//                    chunks[iteration].value.alignments = features;
                    if (chunks[iteration].value.alignments) {
                        chunks[iteration].value.alignments = features;
                    } else {
                        chunks[iteration].value = features;
                    }
                    chunksToRender.push(chunks[iteration].value); // add to chunks to render
                }
            };
        } (i));
    }

    return chunksToRender;
};

*/


