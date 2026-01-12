(function () {
  'use strict';

  var Defined = {
    localhost: 'https://api.yani.tv',
    component: 'yani_tv_online',
    title: 'Yani.TV'
  };

  function Component(object) {
    var network = new Lampa.Reguest();
    var scroll = new Lampa.Scroll({ mask: true, over: true });
    var files = new Lampa.Explorer(object);
    var filter = new Lampa.Filter(object);

    var sources = { 'yani.tv': { name: 'Yani.TV', show: true } };
    var balanser = 'yani.tv';
    var filter_sources = ['yani.tv'];
    var filter_find = { voice: [] };
    var anime_id = null;
    var videos = [];
    var translates_map = {};

    this.initialize = function () {
      var _this = this;

      filter.onSearch = function (value) {
        _this.reset();
        _this.requestSearch(value);
      };

      filter.onBack = function () {
        _this.start();
      };

      filter.onSelect = function (type, a, b) {
        if (type === 'filter') {
          if (a.reset) {
            _this.replaceChoice({ voice: 0 });
            setTimeout(function () {
              Lampa.Select.close();
              Lampa.Activity.replace({ clarification: 0 });
            }, 10);
          } else if (a.stype === 'voice') {
            var choice = _this.getChoice();
            choice.voice = b.index;
            _this.saveChoice(choice);
            _this.displayFilteredVideos(b.index);
            setTimeout(Lampa.Select.close, 10);
          }
        }
      };

      if (filter.addButtonBack) filter.addButtonBack();

      scroll.body().addClass('torrent-list');
      files.appendFiles(scroll.render());
      files.appendHead(filter.render());
      scroll.minus(files.render().find('.explorer__files-head'));

      this.loading(true);
      this.requestSearch(object.search || object.movie.title);
    };

    this.requestSearch = function (query) {
      network.native(
        Defined.localhost + '/search?q=' + encodeURIComponent(query) + '&limit=1',
        function (result) {
          if (result && result.response && result.response.length > 0) {
            anime_id = result.response[0].anime_id;
            this.requestVideos();
          } else {
            this.empty();
          }
        }.bind(this),
        function () {
          this.empty();
        }.bind(this),
        false,
        { dataType: 'json' }
      );
    };

    this.requestVideos = function () {
      network.native(
        Defined.localhost + '/anime/' + anime_id + '/videos',
        function (result) {
          if (result && result.response) {
            videos = result.response;
            this.processTranslates();
            this.display(videos);
          } else {
            this.empty();
          }
        }.bind(this),
        function () {
          this.empty();
        }.bind(this),
        false,
        { dataType: 'json' }
      );
    };

    this.processTranslates = function () {
      var voices = {};
      videos.forEach(function (v) {
        var dub = v.data?.dubbing || 'Основная озвучка';
        if (!voices[dub]) voices[dub] = [];
        voices[dub].push(v);
      });

      filter_find.voice = Object.keys(voices).map(function (title, index) {
        translates_map[index] = title;
        return { title: title, videos: voices[title] };
      });
    };

    this.displayFilteredVideos = function (voiceIndex) {
      var selected = filter_find.voice[voiceIndex];
      if (selected) {
        this.display(selected.videos);
      }
    };

    this.display = function (items) {
      scroll.clear();
      this.draw(items, {
        onEnter: function (item) {
          Lampa.Player.play({
            title: (object.movie.title || '') + ' — Эпизод ' + item.number,
            url: item.iframe_url,
            method: 'iframe'
          });
        }
      });

      this.filter({
        voice: filter_find.voice.map(function (v) { return v.title; })
      }, this.getChoice());
    };

    this.draw = function (items, params) {
      if (!items.length) return this.empty();

      scroll.clear();

      items.forEach(function (element) {
        var html = Lampa.Template.get('lampac_prestige_full', {
          title: 'Эпизод ' + element.number,
          time: '',
          info: element.data?.dubbing || '',
          quality: element.data?.player || ''
        });

        html.on('hover:enter', function () {
          if (params.onEnter) params.onEnter(element);
        });

        scroll.append(html);
      });

      Lampa.Controller.enable('content');
    };

    this.filter = function (filter_items, choice) {
      var select = [];

      if (filter_items.voice && filter_items.voice.length > 1) {
        var voiceItems = filter_items.voice.map(function (name, i) {
          return { title: name, selected: choice.voice === i, index: i };
        });
        select.push({
          title: Lampa.Lang.translate('torrent_parser_voice'),
          subtitle: filter_items.voice[choice.voice],
          items: voiceItems,
          stype: 'voice'
        });
      }

      select.push({ title: Lampa.Lang.translate('torrent_parser_reset'), reset: true });

      filter.set('filter', select);
      filter.set('sort', [{ title: 'Yani.TV', source: 'yani.tv', selected: true }]);
      filter.chosen('sort', ['Yani.TV']);
    };

    this.getChoice = function () {
      var data = Lampa.Storage.cache('online_choice_yani.tv', 3000, {});
      var save = data[object.movie.id] || {};
      Lampa.Arrays.extend(save, { voice: 0 });
      return save;
    };

    this.saveChoice = function (choice) {
      var data = Lampa.Storage.cache('online_choice_yani.tv', 3000, {});
      data[object.movie.id] = choice;
      Lampa.Storage.set('online_choice_yani.tv', data);
    };

    this.replaceChoice = function (choice) {
      var to = this.getChoice();
      Lampa.Arrays.extend(to, choice, true);
      this.saveChoice(to);
    };

    this.reset = function () {
      network.clear();
      scroll.clear();
      scroll.body().append(Lampa.Template.get('lampac_content_loading'));
    };

    this.loading = function (status) {
      if (status) this.activity.loader(true);
      else {
        this.activity.loader(false);
        this.activity.toggle();
      }
    };

    this.empty = function () {
      scroll.clear();
      var html = Lampa.Template.get('lampac_does_not_answer', {});
      html.find('.online-empty__title').text(Lampa.Lang.translate('empty_title_two'));
      html.find('.online-empty__time').text(Lampa.Lang.translate('empty_text'));
      html.find('.online-empty__buttons').remove();
      scroll.append(html);
      this.loading(false);
    };

    this.start = function () {
      this.create();
      files.appendFiles(scroll.render());
      files.appendHead(filter.render());
      scroll.body().addClass('torrent-list');
      Lampa.Controller.add('content', {
        toggle: function () {
          Lampa.Controller.collectionSet(scroll.render(), files.render());
        },
        back: function () {
          Lampa.Activity.backward();
        }
      });
      this.initialize();
    };

    this.create = function () {
      return this.render();
    };

    this.render = function () {
      return files.render();
    };

    this.destroy = function () {
      network.clear();
      files.destroy();
      scroll.destroy();
    };
  }

  // Регистрация плагина
  Lampa.Manifest.plugins = {
    type: 'video',
    name: Defined.title,
    component: Defined.component,
    onContextMenu: function () {
      return { name: 'Смотреть на Yani.TV' };
    },
    onContextLauch: function (movie) {
      Lampa.Component.add(Defined.component, Component);
      Lampa.Activity.push({
        component: Defined.component,
        movie: movie,
        search: movie.title,
        title: Defined.title
      });
    }
  };

  // === ШАБЛОНЫ И СТИЛИ (копия из example.js) ===

  Lampa.Template.add('lampac_css', `
<style>
@charset 'UTF-8';.online-prestige{position:relative;-webkit-border-radius:.3em;border-radius:.3em;background-color:rgba(0,0,0,0.3);display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex}.online-prestige__body{padding:1.2em;line-height:1.3;-webkit-box-flex:1;-webkit-flex-grow:1;-moz-box-flex:1;-ms-flex-positive:1;flex-grow:1;position:relative}@media screen and (max-width:480px){.online-prestige__body{padding:.8em 1.2em}}.online-prestige__img{position:relative;width:13em;-webkit-flex-shrink:0;-ms-flex-negative:0;flex-shrink:0;min-height:8.2em}.online-prestige__img>img{position:absolute;top:0;left:0;width:100%;height:100%;-o-object-fit:cover;object-fit:cover;-webkit-border-radius:.3em;border-radius:.3em;opacity:0;-webkit-transition:opacity .3s;-o-transition:opacity .3s;-moz-transition:opacity .3s;transition:opacity .3s}.online-prestige__img--loaded>img{opacity:1}@media screen and (max-width:480px){.online-prestige__img{width:7em;min-height:6em}}.online-prestige__folder{padding:1em;-webkit-flex-shrink:0;-ms-flex-negative:0;flex-shrink:0}.online-prestige__folder>svg{width:4.4em !important;height:4.4em !important}.online-prestige__viewed{position:absolute;top:1em;left:1em;background:rgba(0,0,0,0.45);-webkit-border-radius:100%;border-radius:100%;padding:.25em;font-size:.76em}.online-prestige__viewed>svg{width:1.5em !important;height:1.5em !important}.online-prestige__episode-number{position:absolute;top:0;left:0;right:0;bottom:0;display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;-moz-box-pack:center;-ms-flex-pack:center;justify-content:center;font-size:2em}.online-prestige__loader{position:absolute;top:50%;left:50%;width:2em;height:2em;margin-left:-1em;margin-top:-1em;background:url(./img/loader.svg) no-repeat center center;-webkit-background-size:contain;-o-background-size:contain;background-size:contain}.online-prestige__head,.online-prestige__footer{display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-pack:justify;-webkit-justify-content:space-between;-moz-box-pack:justify;-ms-flex-pack:justify;justify-content:space-between;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center}.online-prestige__timeline{margin:.8em 0}.online-prestige__timeline>.time-line{display:block !important}.online-prestige__title{font-size:1.7em;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:1;line-clamp:1;-webkit-box-orient:vertical}@media screen and (max-width:480px){.online-prestige__title{font-size:1.4em}}.online-prestige__time{padding-left:2em}.online-prestige__info{display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center}.online-prestige__info>*{overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:1;line-clamp:1;-webkit-box-orient:vertical}.online-prestige__quality{padding-left:1em;white-space:nowrap}.online-prestige__scan-file{position:absolute;bottom:0;left:0;right:0}.online-prestige .online-prestige-split{font-size:.8em;margin:0 1em;-webkit-flex-shrink:0;-ms-flex-negative:0;flex-shrink:0}.online-prestige.focus::after{content:'';position:absolute;top:-0.6em;left:-0.6em;right:-0.6em;bottom:-0.6em;-webkit-border-radius:.7em;border-radius:.7em;border:solid .3em #fff;z-index:-1;pointer-events:none}.online-prestige+.online-prestige{margin-top:1.5em}.online-prestige--folder .online-prestige__footer{margin-top:.8em}.online-prestige-watched{padding:1em}.online-prestige-watched__icon>svg{width:1.5em;height:1.5em}.online-prestige-watched__body{padding-left:1em;padding-top:.1em;display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-flex-wrap:wrap;-ms-flex-wrap:wrap;flex-wrap:wrap}.online-prestige-watched__body>span+span::before{content:' •  ';vertical-align:top;display:inline-block;margin:0 .5em}.online-prestige-rate{display:-webkit-inline-box;display:-webkit-inline-flex;display:-moz-inline-box;display:-ms-inline-flexbox;display:inline-flex;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center}.online-prestige-rate>svg{width:1.3em !important;height:1.3em !important}.online-prestige-rate>span{font-weight:600;font-size:1.1em;padding-left:.7em}.online-empty{line-height:1.4}.online-empty__title{font-size:1.8em;margin-bottom:.3em}.online-empty__time{font-size:1.2em;font-weight:300;margin-bottom:1.6em}.online-empty__buttons{display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex}.online-empty__buttons>*+*{margin-left:1em}.online-empty__button{background:rgba(0,0,0,0.3);font-size:1.2em;padding:.5em 1.2em;-webkit-border-radius:.2em;border-radius:.2em;margin-bottom:2.4em}.online-empty__button.focus{background:#fff;color:black}.online-empty__templates .online-empty-template:nth-child(2){opacity:.5}.online-empty__templates .online-empty-template:nth-child(3){opacity:.2}.online-empty-template{background-color:rgba(255,255,255,0.3);padding:1em;display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center;-webkit-border-radius:.3em;border-radius:.3em}.online-empty-template>*{background:rgba(0,0,0,0.3);-webkit-border-radius:.3em;border-radius:.3em}.online-empty-template__ico{width:4em;height:4em;margin-right:2.4em}.online-empty-template__body{height:1.7em;width:70%}.online-empty-template+.online-empty-template{margin-top:1em}
</style>
  `);

  $('body').append(Lampa.Template.get('lampac_css', {}, true));

  Lampa.Template.add('lampac_prestige_full', `
<div class="online-prestige online-prestige--full selector">
  <div class="online-prestige__body">
    <div class="online-prestige__head">
      <div class="online-prestige__title">{title}</div>
      <div class="online-prestige__time">{time}</div>
    </div>
    <div class="online-prestige__footer">
      <div class="online-prestige__info">{info}</div>
      <div class="online-prestige__quality">{quality}</div>
    </div>
  </div>
</div>
  `);

  Lampa.Template.add('lampac_content_loading', `
<div class="online-empty">
  <div class="broadcast__scan"><div></div></div>
  <div class="online-empty__templates">
    <div class="online-empty-template selector">
      <div class="online-empty-template__ico"></div>
      <div class="online-empty-template__body"></div>
    </div>
    <div class="online-empty-template">
      <div class="online-empty-template__ico"></div>
      <div class="online-empty-template__body"></div>
    </div>
    <div class="online-empty-template">
      <div class="online-empty-template__ico"></div>
      <div class="online-empty-template__body"></div>
    </div>
  </div>
</div>
  `);

  Lampa.Template.add('lampac_does_not_answer', `
<div class="online-empty">
  <div class="online-empty__title">#{empty_title_two}</div>
  <div class="online-empty__time">#{empty_text}</div>
  <div class="online-empty__templates">
    <div class="online-empty-template">
      <div class="online-empty-template__ico"></div>
      <div class="online-empty-template__body"></div>
    </div>
    <div class="online-empty-template">
      <div class="online-empty-template__ico"></div>
      <div class="online-empty-template__body"></div>
    </div>
    <div class="online-empty-template">
      <div class="online-empty-template__ico"></div>
      <div class="online-empty-template__body"></div>
    </div>
  </div>
</div>
  `);
})();
