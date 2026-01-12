(function () {
  'use strict';

  function initYaniPlugin() {
    // === ИСПРАВЛЕНО: убраны пробелы в URL ===
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

      var anime_id = null;
      var videos = [];
      var filter_find = { voice: [] };

      this.initialize = function () {
        var _this = this;

        filter.onSearch = function (value) {
          _this.reset();
          _this.requestSearch(value);
        };

        if (filter.addButtonBack) filter.addButtonBack();

        scroll.body().addClass('torrent-list');
        files.appendFiles(scroll.render());
        files.appendHead(filter.render());

        this.loading(true);
        this.requestSearch(object.search || object.movie.title);
      };

      this.requestSearch = function (query) {
        network.native(
          Defined.localhost + '/search?q=' + encodeURIComponent(query) + '&limit=1',
          function (result) {
            if (result && Array.isArray(result.response) && result.response.length > 0) {
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
            if (result && Array.isArray(result.response)) {
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

        filter_find.voice = Object.keys(voices).map(function (title) {
          return { title: title, videos: voices[title] };
        });
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
        }, { voice: 0 });
      };

      this.draw = function (items) {
        if (!items || !items.length) return this.empty();

        scroll.clear();
        items.forEach(function (element) {
          var html = Lampa.Template.get('lampac_prestige_full', {
            title: 'Эпизод ' + element.number,
            time: '',
            info: element.data?.dubbing || '',
            quality: element.data?.player || ''
          });

          html.on('hover:enter', function () {
            Lampa.Player.play({
              title: (object.movie.title || '') + ' — Эпизод ' + element.number,
              url: element.iframe_url,
              method: 'iframe'
            });
          });

          scroll.append(html);
        });

        Lampa.Controller.enable('content');
      };

      this.filter = function (filter_items) {
        var select = [];
        if (filter_items.voice && filter_items.voice.length > 1) {
          var voiceItems = filter_items.voice.map(function (name, i) {
            return { title: name, index: i };
          });
          select.push({
            title: 'Озвучка',
            subtitle: filter_items.voice[0],
            items: voiceItems,
            stype: 'voice'
          });
        }
        select.push({ title: 'Сбросить', reset: true });
        filter.set('filter', select);
      };

      this.empty = function () {
        scroll.clear();
        scroll.append($('<div class="online-empty"><div class="online-empty__title">Yani.TV</div><div class="online-empty__time">Аниме не найдено</div></div>'));
        this.loading(false);
      };

      this.loading = function (status) {
        if (!this.activity) this.activity = Lampa.Activity;
        if (status) this.activity.loader(true);
        else {
          this.activity.loader(false);
          this.activity.toggle();
        }
      };

      this.reset = function () {
        network.clear();
        scroll.clear();
      };

      this.start = function () {
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

      this.render = function () {
        return files.render();
      };

      this.destroy = function () {
        network.clear();
        files.destroy();
        scroll.destroy();
      };
    }

    // === РЕГИСТРАЦИЯ ПЛАГИНА ===
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

    // === ШАБЛОНЫ ===
    if (!$('#yani-tv-css').length) {
      $('body').append('<style id="yani-tv-css">@charset "UTF-8";.online-prestige{position:relative;-webkit-border-radius:.3em;border-radius:.3em;background-color:rgba(0,0,0,0.3);display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex}.online-prestige__body{padding:1.2em;line-height:1.3;-webkit-box-flex:1;-webkit-flex-grow:1;-moz-box-flex:1;-ms-flex-positive:1;flex-grow:1;position:relative}@media screen and (max-width:480px){.online-prestige__body{padding:.8em 1.2em}}.online-prestige__head,.online-prestige__footer{display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-pack:justify;-webkit-justify-content:space-between;-moz-box-pack:justify;-ms-flex-pack:justify;justify-content:space-between;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center}.online-prestige__title{font-size:1.7em;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:1;line-clamp:1;-webkit-box-orient:vertical}@media screen and (max-width:480px){.online-prestige__title{font-size:1.4em}}.online-prestige__info{display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center}.online-prestige__quality{padding-left:1em;white-space:nowrap}.online-empty{line-height:1.4}.online-empty__title{font-size:1.8em;margin-bottom:.3em}.online-empty__time{font-size:1.2em;font-weight:300}</style>');
    }

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
  }

  // === ОТЛОЖЕННАЯ ИНИЦИАЛИЗАЦИЯ ===
  if (typeof Lampa !== 'undefined' && Lampa.Manifest) {
    initYaniPlugin();
  } else {
    var check = setInterval(function () {
      if (typeof Lampa !== 'undefined' && Lampa.Manifest) {
        clearInterval(check);
        initYaniPlugin();
      }
    }, 100);
  }
})();
