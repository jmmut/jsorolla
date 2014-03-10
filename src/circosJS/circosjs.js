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