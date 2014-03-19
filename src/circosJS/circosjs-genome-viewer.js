/**
 * Created by jag on 10/03/2014.
 */



function CircosJS(args) {
    // Using Underscore 'extend' function to extend and add Backbone Events
    _.extend(this, Backbone.Events);

    var _this = this;
    this.id = Utils.genId("CircularGenomeViewer");


    //set default args
    this.radius = 200;
    this.arcWidth = 70;
//

    this.degreeRotation = 0;
    //set instantiation args, must be last
    _.extend(this, args);

    this.radiusYOffset = 650;

    this.x = this.width / 2;
    this.y = this.arcWidth - this.radius + this.radiusYOffset;


    this.genomes = [];
    this.genomesData = {};
    this.genomesChromosomes = {};

    //events attachments
    this.on(this.handlers);

    if (this.autoRender) {
        this.render();
    }
};
CircosJS.prototype = {



    render: function () {
        var _this = this;

        this.rendered = false;

        this.targetDiv = $('#' + this.targetId)[0];
        this.div = $('<div id="circos" class=""></div>')[0];
        $(this.targetDiv).append(this.div);


//        [ <span id="test"></span> - <span id="test2"></span> ]
        this.title = $('<div id="title" class="container"><h1>Circular Genome Viewer </h1></div>')[0];
        this.bar = $('<div id="bar"  class="container"></div>')[0];
        this.content = $('<div class="" id="content"></div>')[0];


        $(this.div).append(this.title);
        $(this.div).append(this.bar);
        $(this.div).append(this.content);

        this.svg = SVG.init(this.content, {
            "width": this.width,
            "height": this.height
        });

        this.group = SVG.addChild(this.svg, 'g');
//        this.selectionGroup = SVG.addChild(this.svg, 'g');
//
        /** Rotate **/
        var downX, downY, moveX, angle = 0, lastDegree = 0, degree = 0;
        $(this.svg).mousedown(function (event) {
            downX = event.offsetX;
            $(this).mousemove(function (event) {
                var newX = (downX - event.offsetX)
                degree = (newX * 0.2) + lastDegree;
                _this.degreeRotation = degree;
                _this.group.setAttribute('transform', 'rotate(' + degree + ' ' + _this.x + ' ' + _this.y + ')')
            });
        });
        $(this.svg).mouseup(function (event) {
            $(_this.svg).off('mousemove');
//            _this.selectionCurve.setAttribute('visibility', 'hidden');
            downX = null;
            downY = null;
            moveX = null;
            lastDegree = degree;
        });

        this.genomesChromosomes['hsapiens'] = this._fetchData('hsapiens');

    },
    _fetchData: function (species) {
        var _this = this;
        var chromosomes = [];
        var sortfunction = function (a, b) {
            var IsNumber = true;
            for (var i = 0; i < a.name.length && IsNumber == true; i++) {
                if (isNaN(a.name[i])) {
                    IsNumber = false;
                }
            }
            if (!IsNumber) return 1;
            return (a.name - b.name);
        };
        CellBaseManager.get({
            species: species,
            category: 'genomic',
            subCategory: 'chromosome',
            resource: 'all',
            async: false,
            success: function (data) {
                chromosomes = data.response.result.chromosomes;
                chromosomes.sort(sortfunction);
                /**/
                chromosomes.pop();
                chromosomes.splice(22, 1);
                /**/
            }
        });
        return chromosomes;
    },
    addGenome: function (args) {
        var _this = this;
        if (typeof this.genomesChromosomes[args.species] === 'undefined') {
            this.genomesChromosomes[args.species] = this._fetchData(args.species);
        }
        args.chromosomes = this.genomesChromosomes[args.species];
        args.handlers = {
            'region:change': function (e) {
                _this.trigger('region:change', e);
            }
        };
        var genome = new Genome(args);
        this.genomes.push(genome);
        this._draw();
    },
    clean: function () {
        $(this.bar).empty();
        $(this.group).empty();
        this.group.setAttribute('transform', 'rotate(' + this.degreeRotation + ' ' + this.x + ' ' + this.y + ')')
//        $(this.selectionGroup).empty();

    },
    _clean: function () {
        $(this.group).empty();
        this.group.setAttribute('transform', 'rotate(' + this.degreeRotation + ' ' + this.x + ' ' + this.y + ')')
    },
    draw: function () {
        this.clean();
        /** Navigation Bar **/
        this.navigationBar = this._createNavigationBar(this.bar);

    },
    _draw: function () {
//        var _this = this;
        this._clean();
        /** draw components **/

        this._drawGenomes(this.genomes);
        //this.drawLink()
    },
    drawLink: function () {

        for (var i = 0; i < 1; i++) {
            var d = '';
            var angleStart1 = 10;
            var angleEnd1 = 20;
            var angleStart2 = 270;
            var angleEnd2 = 290;

            var coordsStart1 = SVG._polarToCartesian(this.x, this.y, this.radius - 20, angleStart1);
            var coordsEnd1 = SVG._polarToCartesian(this.x, this.y, this.radius - 20, angleEnd1);

            var coordsStart2 = SVG._polarToCartesian(this.x, this.y, this.radius - 20, angleStart2);
            var coordsEnd2 = SVG._polarToCartesian(this.x, this.y, this.radius - 20, angleEnd2);


            d += SVG.describeArc(this.x, this.y, this.radius - 20, angleStart1, angleEnd1) + ' ';
            d += ['Q', this.x, this.y, coordsEnd2.x, coordsEnd2.y, ' '].join(' ');
            d += SVG.describeArc(this.x, this.y, this.radius - 20, angleStart2, angleEnd2) + ' ';
            d += [ 'Q', this.x, this.y, coordsEnd1.x, coordsEnd1.y, ' '].join(' ');

            var curve = SVG.addChild(this.group, 'path', {
                d: d,
                'stroke': 'red',
                'stroke-width': 2,
                'opacity': 1,
                'fill': 'crimson',
                'visibility': 'visible',
                'opacity': 0.7,
                'z-index': 10
            });
        }
//        for (var i = 0; i < 10; i++) {
//        }

    },
    _calculateTotalSize: function (items) {
        var totalSize = 0;
        for (var i = 0; i < items.length; i++) {
            totalSize += items[i].size;
        }
        return totalSize;
    },
    _sortFunction: function (a, b) {
        var flag = false;
        if (typeof a.position == 'undefined') {
            a.position = Number.MAX_VALUE;
        }
        if (typeof b.position == 'undefined') {
            b.position = Number.MAX_VALUE;
        }
        return a.position - b.position;
    },
    _drawGenomes: function () {
        this.genomes.sort(this._sortFunction);

        var separationPixels = 4;
        console.log(this.genomes);
        var separation = (separationPixels * 360) / (2 * Math.PI * this.radius);

        var totalSize = this._calculateTotalSize(this.genomes);
        var c = 360 / totalSize;
        var angleOffset = 0;
        var genome_d = [];
        var genome;
        for (var i = 0; i < this.genomes.length; i++) {
            genome = this.genomes[i];
            genome.angleSize = (genome.size * c) - separation;
            genome.angleStart = angleOffset + (separation / 2);
            genome.angleEnd = genome.angleStart + genome.angleSize;
            angleOffset += genome.angleSize + separation;

            genome_d.push(SVG.describeArc(this.x, this.y, this.radius, genome.angleStart, genome.angleEnd) + ' ');

            this.genomesData[genome.id] = genome;
            this.genomesData[genome.id]['segmentData'] = {};
        }

        var color = '#778899';
        for (var i = 0; i < genome_d.length; i++) {
            var curve = SVG.addChild(this.group, "path", {
                "d": genome_d[i],
//                "stroke": 'lightblue',
//                "stroke": Utils.colorLuminance(color, i/5),
//                "stroke": 'lightblue',
                "stroke-width": this.arcWidth,
                "fill": "none"
            });
            this.genomes[i].draw({
                radius: this.radius,
                x: this.x,
                y: this.y,
                targetId: this.group,
                arcWidth: this.arcWidth
            });
        }


    },
    _createNavigationBar: function (targetId) {
        var _this = this;
        var navigationBar = new CircosNavigationBar({
            targetId: targetId,
            autoRender: true,
            genomesChromosomes: this.genomesChromosomes,
            handlers: {
                'zoom-out-button:click': function () {
                    if (_this.radius - 100 > 0) {
                        _this.radius -= 100;
                        console.log(_this.radius)
                        _this.y = _this.arcWidth - _this.radius + _this.radiusYOffset;
                        _this._draw();
                    }
                },
                'zoom-in-button:click': function () {
                    _this.radius += 100;
                    console.log(_this.radius)
                    _this.y = _this.arcWidth - _this.radius + _this.radiusYOffset;
//                    _this.x =
                    _this._draw();
                },
                'zoom-restore-button:click': function () {
                    _this.radius = 250;
                    _this.y = _this.arcWidth - _this.radius + _this.radiusYOffset;
                    _this._draw();
                },
                'chromosome-buttons:click': function (event) {

                    var chromosomes = this.genomesChromosomes['hsapiens'];
                    for (var i = 0; i < chromosomes.length; i++) {
                        var chr = chromosomes[i];
                        chr.visible = event.names[chr.name];
                    }
                    _this._draw();
                }

            }
        });
        return navigationBar;
    }

}