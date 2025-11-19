(function (factory) {
     'use strict';
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['jquery'], factory);
    } else if (typeof exports === 'object') {
        // CommonJS
        factory(require('jquery'));
    } else {
        // Browser globals
        factory(jQuery);
    }
}(function ($) {
  /**
   * 计数动画插件核心对象
   * @param {HTMLElement} element 目标元素
   * @param {Object} options 用户配置
   */
  var CountTo = function (element, options) {
    this.$element = $(element);
    this.options  = $.extend({}, CountTo.DEFAULTS, this.dataOptions(), options);
    this.init();
  };

  /**
   * 默认配置
   * @type {Object}
   */
  CountTo.DEFAULTS = {
    from: 0,               // the number the element should start at
    to: 0,                 // the number the element should end at
    speed: 1000,           // how long it should take to count between the target numbers
    refreshInterval: 100,  // how often the element should be updated
    decimals: 0,           // the number of decimal places to show
    formatter: formatter,  // handler for formatting the value before rendering
    onUpdate: null,        // callback method for every time the element is updated
    onComplete: null       // callback method for when the element finishes updating
  };

  /**
   * 初始化内部状态
   */
  CountTo.prototype.init = function () {
    var from = Number(this.options.from);
    var to = Number(this.options.to);
    var speed = Number(this.options.speed);
    var refresh = Number(this.options.refreshInterval);
    var decimals = Number(this.options.decimals);

    this.value     = isFinite(from) ? from : 0;
    var loopsCalc  = refresh > 0 ? Math.ceil(speed / refresh) : 0;
    this.loops     = Math.max(1, loopsCalc);
    this.loopCount = 0;
    this.increment = (to - this.value) / this.loops;
    this.options.decimals = isFinite(decimals) && decimals >= 0 ? decimals : 0;
  };

  /**
   * 从数据属性读取配置
   * @returns {Object}
   */
  CountTo.prototype.dataOptions = function () {
    var options = {
      from:            this.$element.data('from'),
      to:              this.$element.data('to'),
      speed:           this.$element.data('speed'),
      refreshInterval: this.$element.data('refresh-interval'),
      decimals:        this.$element.data('decimals')
    };

    Object.keys(options).forEach(function (key) {
      if (typeof options[key] === 'undefined') {
        delete options[key];
      }
    });

    return options;
  };

  /**
   * 更新当前值并渲染
   */
  CountTo.prototype.update = function () {
    this.value += this.increment;
    this.loopCount++;

    this.render();

    if (typeof this.options.onUpdate === 'function') {
      this.options.onUpdate.call(this.$element, this.value);
    }

    if (this.loopCount >= this.loops) {
      clearInterval(this.interval);
      this.interval = null;
      this.value = this.options.to;
      this.render();

      if (typeof this.options.onComplete === 'function') {
        this.options.onComplete.call(this.$element, this.value);
      }
    }
  };

  /**
   * 将格式化后的数值写入到元素
   */
  CountTo.prototype.render = function () {
    var formattedValue = this.options.formatter.call(this.$element, this.value, this.options);
    this.$element.text(formattedValue);
  };

  /**
   * 重启动画
   */
  CountTo.prototype.restart = function () {
    this.stop();
    this.init();
    this.start();
  };

  /**
   * 开始动画
   */
  CountTo.prototype.start = function () {
    this.stop();
    this.render();
    var refresh = Number(this.options.refreshInterval);
    if (refresh > 0) {
      this.interval = setInterval(this.update.bind(this), refresh);
    } else {
      this.value = this.options.to;
      this.render();
      if (typeof this.options.onComplete === 'function') {
        this.options.onComplete.call(this.$element, this.value);
      }
    }
  };

  /**
   * 停止动画
   */
  CountTo.prototype.stop = function () {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  };

  /**
   * 切换开始/停止
   */
  CountTo.prototype.toggle = function () {
    if (this.interval) {
      this.stop();
    } else {
      this.start();
    }
  };

  /**
   * 数值格式化函数
   * @param {number} value 当前值
   * @param {Object} options 配置
   * @returns {string}
   */
  function formatter(value, options) {
    return Number(value).toFixed(options.decimals);
  }

  /**
   * jQuery 插件入口
   * @param {Object|string} option 配置或方法名
   */
  $.fn.countTo = function (option) {
    return this.each(function () {
      var $this   = $(this);
      var data    = $this.data('countTo');
      var init    = !data || typeof option === 'object';
      var options = typeof option === 'object' ? option : {};
      var method  = typeof option === 'string' ? option : 'start';

      if (init) {
        if (data) data.stop();
        $this.data('countTo', data = new CountTo(this, options));
      }

      if (typeof data[method] !== 'function') {
        method = 'start';
      }
      data[method].call(data);
    });
  };
}));
