(function () {
'use strict';

// === ТОКЕН ДЛЯ KODIK API (публичный) ===
    //FIXME временно
var KODIK_TOKEN = '41dd95f84c21719b09d6c71182237a25';

function component(object) {
    var self = this;
    var network = new Lampa.Reguest();
    var scroll = new Lampa.Scroll({ mask: true, over: true });
    var files = new Lampa.Explorer(object);
    var filter = new Lampa.Filter(object);

    var select_title = '';
    var extract = { items: [], seasons: [] };
    var choice = { season: 0, voice: 0 };
    var initialized = false;

    // === МЕТОДЫ ЖИЗНЕННОГО ЦИКЛА ===

    this.create = function () {
        scroll.body().addClass('torrent-list');
        files.appendHead(filter.render());
        files.appendFiles(scroll.render());

        filter.onBack = function () { Lampa.Activity.backward(); };
        filter.onSelect = function (type, a, b) {
            if (a.reset) {
                choice = { season: 0, voice: 0 };
                applyFilter();
            } else {
                choice[a.stype] = b.index;
                applyFilter();
            }
        };

        this.search();
        return this.render();
    };

    this.start = function () {
        if (Lampa.Activity.active().activity !== this.activity) return;
        if (!initialized) {
            initialized = true;
            this.loading(true);
            this.search();
        }

        Lampa.Background.immediately(Lampa.Utils.cardImgBackground(object.movie));

        Lampa.Controller.add('content', {
            toggle: function () {
                Lampa.Controller.collectionSet(scroll.render(), files.render());
                Lampa.Controller.collectionFocus(lastItem || false, scroll.render());
            },
            back: function () { Lampa.Activity.backward(); },
            up: function () { Navigator.move('up'); },
            down: function () { Navigator.move('down'); },
            right: function () {
                if (Navigator.canmove('right')) Navigator.move('right');
                else filter.show(Lampa.Lang.translate('title_filter'), 'filter');
            },
            left: function () {
                if (Navigator.canmove('left')) Navigator.move('left');
                else Lampa.Controller.toggle('menu');
            }
        });

        if (this.inActivity()) {
            Lampa.Controller.toggle('content');
        }
    };

    this.inActivity = function () {
        var body = $('body');
        return !(
            body.hasClass('settings--open') ||
            body.hasClass('menu--open') ||
            body.hasClass('keyboard-input--visible') ||
            body.hasClass('selectbox--open') ||
            body.hasClass('search--open') ||
            body.hasClass('ambience--enable') ||
            $('div.modal').length
        );
    };

    this.render = function () { return files.render(); };
    this.destroy = function () { network.clear(); scroll.destroy(); files.destroy(); };

    // === ОСНОВНАЯ ЛОГИКА ===

    this.search = function () {
        this.loading(true);
        select_title = object.search || object.movie.title;
        var kp_id = object.movie.kinopoisk_id ? parseInt(object.movie.kinopoisk_id) : 0;
        var imdb_id = object.movie.imdb_id || '';

        var params = 'token=' + KODIK_TOKEN + '&limit=100&translation_type=voice';
        if (kp_id) params += '&kinopoisk_id=' + kp_id;
        else if (imdb_id) params += '&imdb_id=' + encodeURIComponent(imdb_id);
        else params += '&title=' + encodeURIComponent(select_title);

        network.timeout(10000);
        network.native('https://kodikapi.com/search?' + params, function (json) {
            if (json && json.results && json.results.length) {
                var mediaMap = {};
                json.results.forEach(function (item) {
                    var id = item.id || item.kinopoisk_id || item.imdb_id;
                    if (!mediaMap[id]) mediaMap[id] = [];
                    mediaMap[id].push(item);
                });
                var firstId = Object.keys(mediaMap)[0];
                if (firstId) {
                    fetchFullInfo(mediaMap[firstId][0]);
                    return;
                }
            }
            this.emptyForQuery(select_title);
        }.bind(this), function () {
            this.emptyForQuery(select_title);
        }.bind(this));
    };

    function fetchFullInfo(media) {
        var params = 'token=' + KODIK_TOKEN + '&limit=100&with_episodes=true';
        if (media.shikimori_id) params += '&shikimori_id=' + media.shikimori_id;
        else if (media.worldart_link) params += '&worldart_link=' + encodeURIComponent(media.worldart_link);
        else if (media.kinopoisk_id) params += '&kinopoisk_id=' + media.kinopoisk_id;
        else if (media.imdb_id) params += '&imdb_id=' + encodeURIComponent(media.imdb_id);
        else if (media.id) params += '&id=' + media.id;
        else return component.emptyForQuery(select_title);

        network.timeout(10000);
        network.native('https://kodikapi.com/search?' + params, function (json) {
            if (json && json.results) {
                extractData(json.results);
                applyFilter();
                this.loading(false);
            } else {
                this.emptyForQuery(select_title);
            }
        }.bind(this), function () {
            this.emptyForQuery(select_title);
        }.bind(this));
    }

    function extractData(items) {
        var seasons = [];
        items.forEach(function (c) {
            if (c.seasons) {
                for (var season_id in c.seasons) {
                    if (!seasons.some(s => s.id === season_id)) {
                        seasons.push({
                            id: season_id,
                            title: Lampa.Lang.translate('torrent_serial_season') + ' ' + season_id
                        });
                    }
                }
            }
        });
        seasons.sort((a, b) => a.id - b.id);
        extract = { items: items, seasons: seasons };
    }

    function applyFilter() {
        var filter_items = {
            season: extract.seasons.map(s => s.title),
            voice: []
        };

        if (extract.seasons.length) {
            var season_id = extract.seasons[choice.season]?.id;
            extract.items.forEach(c => {
                if (c.seasons?.[season_id] && c.translation) {
                    if (!filter_items.voice.some(v => v.id === c.translation.id)) {
                        filter_items.voice.push({
                            id: c.translation.id,
                            title: c.translation.title
                        });
                    }
                }
            });
        }

        if (choice.season >= filter_items.season.length) choice.season = 0;
        if (choice.voice >= filter_items.voice.length) choice.voice = 0;

        var select = [{ title: Lampa.Lang.translate('torrent_parser_reset'), reset: true }];
        if (filter_items.season.length > 1) {
            select.push({
                title: Lampa.Lang.translate('torrent_serial_season'),
                subtitle: filter_items.season[choice.season],
                items: filter_items.season.map((t, i) => ({ title: t, selected: i === choice.season, index: i })),
                stype: 'season'
            });
        }
        if (filter_items.voice.length) {
            select.push({
                title: Lampa.Lang.translate('torrent_parser_voice'),
                subtitle: filter_items.voice[choice.voice]?.title || '',
                items: filter_items.voice.map((v, i) => ({ title: v.title, selected: i === choice.voice, index: i })),
                stype: 'voice'
            });
        }
        filter.set('filter', select);
        renderItems(filtredItems(filter_items));
    }

    function filtredItems(filter_items) {
        var items = [];
        if (extract.seasons.length) {
            var season_id = extract.seasons[choice.season]?.id;
            var voice = filter_items.voice[choice.voice];
            if (voice) {
                var translation = extract.items.find(c =>
                    c.seasons?.[season_id] && c.translation?.id === voice.id
                );
                if (translation && translation.seasons?.[season_id]?.episodes) {
                    var episodes = translation.seasons[season_id].episodes;
                    for (var ep in episodes) {
                        items.push({
                            title: self.formatEpisodeTitle(season_id, ep),
                            quality: translation.quality || '360p ~ 1080p',
                            info: ' / ' + voice.title,
                            season: '' + season_id,
                            episode: parseInt(ep),
                            link: episodes[ep]
                        });
                    }
                }
            }
        } else {
            extract.items.forEach(c => {
                if (!c.seasons) {
                    items.push({
                        title: c.translation?.title || select_title,
                        quality: c.quality || '360p ~ 1080p',
                        info: '',
                        link: c.link
                    });
                }
            });
        }
        return items;
    }

    var lastItem = null;

    function renderItems(items) {
        scroll.clear();
        items.forEach(el => {
            var hash = Lampa.Utils.hash(
                el.season ? [el.season, el.season > 10 ? ':' : '', el.episode, object.movie.original_title].join('') : object.movie.original_title
            );
            var view = Lampa.Timeline.view(hash);
            var item = Lampa.Template.get('online_mod', el);
            item.append(Lampa.Timeline.render(view));

            item.on('hover:enter', function () {
                getStream(el, function (streamUrl) {
                    if (streamUrl) {
                        Lampa.Player.play({ url: streamUrl, title: el.title, timeline: view });
                    } else {
                        Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
                    }
                });
            });

            lastItem = item[0];
            scroll.append(item);
        });
    }

    function getStream(element, callback) {
        if (!element.link) return callback('');
        var url = element.link.replace(/^\/\//, 'https://');

        network.timeout(10000);
        network.native(url, function (html) {
            var match = html.match(/\burlParams = '([^']+)'/);
            if (!match) return callback('');

            try {
                var params = JSON.parse(match[1]);
                var videoMatch = html.match(/videoInfo\.(type|hash|id) = '([^']+)'/g);
                if (!videoMatch || videoMatch.length < 3) return callback('');

                var type = '', hash = '', id = '';
                videoMatch.forEach(m => {
                    var parts = m.split(" = '");
                    if (parts[0].includes('type')) type = parts[1].slice(0, -1);
                    if (parts[0].includes('hash')) hash = parts[1].slice(0, -1);
                    if (parts[0].includes('id')) id = parts[1].slice(0, -1);
                });

                var playerMatch = html.match(/<script[^>]*src="([^"]*app\.player_single[^"]*)"/);
                if (!playerMatch) return callback('');

                var playerUrl = url.split('/').slice(0, 3).join('/') + playerMatch[1];
                network.timeout(10000);
                network.native(playerUrl, function (playerJs) {
                    var infoMatch = playerJs.match(/url:\s*atob\("([^"]+)"\)/);
                    if (!infoMatch) return callback('');

                    try {
                        var apiUrl = atob(infoMatch[1]);
                        var postdata = 'd=' + params.d + '&d_sign=' + params.d_sign +
                            '&pd=' + params.pd + '&pd_sign=' + params.pd_sign +
                            '&ref=' + params.ref + '&ref_sign=' + params.ref_sign +
                            '&bad_user=true&cdn_is_working=true' +
                            '&type=' + type + '&hash=' + hash + '&id=' + id + '&info=%7B%7D';

                        network.timeout(10000);
                        network.native(url.split('/').slice(0, 3).join('/') + apiUrl, function (resp) {
                            if (resp.links) {
                                var qualities = Object.keys(resp.links).sort((a, b) => parseInt(b) - parseInt(a));
                                if (qualities.length) {
                                    var src = resp.links[qualities[0]][0]?.src;
                                    if (src) {
                                        try {
                                            src = atob(src.replace(/[a-zA-Z]/g, x =>
                                                String.fromCharCode((x <= 'Z' ? 90 : 122) >= (x = x.charCodeAt(0) + 13) ? x : x - 26)
                                            ));
                                        } catch (e) {}
                                        callback(src);
                                        return;
                                    }
                                }
                            }
                            callback('');
                        }, function () { callback(''); });
                    } catch (e) { callback(''); }
                }, function () { callback(''); });
            } catch (e) { callback(''); }
        }, function () { callback(''); }, false, { dataType: 'text' });
    }

    this.loading = function (status) {
        if (status) this.activity.loader(true);
        else this.activity.loader(false);
    };

    this.emptyForQuery = function (query) {
        var empty = Lampa.Template.get('list_empty');
        empty.find('.empty__descr').text(
            Lampa.Lang.translate('online_mod_query_start') + ' (' + query + ') ' + Lampa.Lang.translate('online_mod_query_end')
        );
        scroll.append(empty);
        this.loading(false);
    };

    this.formatEpisodeTitle = function (s, e) {
        return (s ? 'S' + s + ' / ' : '') + (Lampa.Lang.translate('torrent_serial_episode') + ' ' + e);
};
}

// === ЛОКАЛИЗАЦИЯ ===
Lampa.Lang.add({
    online_mod_query_start: { ru: 'По запросу', en: 'On request' },
    online_mod_query_end: { ru: 'нет результатов', en: 'no results' },
    online_mod_nolink: { ru: 'Не удалось извлечь ссылку', en: 'Failed to fetch link' },
    torrent_serial_season: { ru: 'Сезон', en: 'Season' },
    torrent_serial_episode: { ru: 'Эпизод', en: 'Episode' },
    torrent_parser_voice: { ru: 'Озвучка', en: 'Voice' },
    torrent_parser_reset: { ru: 'Сбросить', en: 'Reset' }
});

// === ШАБЛОНЫ ===
Lampa.Template.add('online_mod', `
<div class="online selector">
  <div class="online__body">
    <div style="position:absolute;left:0;top:-0.3em;width:2.4em;height:2.4em">
      <svg viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="64" cy="64" r="56" stroke="white" stroke-width="16"/>
        <path d="M90.5 64.3827L50 87.7654L50 41L90.5 64.3827Z" fill="white"/>
      </svg>
    </div>
    <div class="online__title" style="padding-left:2.1em;">{title}</div>
    <div class="online__quality" style="padding-left:3.4em;">{quality}{info}</div>
  </div>
</div>`);

// === РЕГИСТРАЦИЯ КОМПОНЕНТА ===
Lampa.Component.add('kodik_only', component);

// === МАНИФЕСТ ПЛАГИНА ===
Lampa.Manifest.plugins = {
    type: 'video',
    version: '1.0',
    name: 'Kodik Only',
    description: 'Прямой поиск через Kodik API',
    component: 'kodik_only',
    onContextMenu: function (obj) {
        return { name: 'Смотреть на Kodik', description: '' };
    },
    onContextLauch: function (obj) {
        Lampa.Activity.push({
            url: '',
            title: 'Kodik',
            component: 'kodik_only',
            movie: obj,
            search: obj.title,
            page: 1
        });
    }
};

// === КНОПКА НА СТРАНИЦЕ ФИЛЬМА ===
Lampa.Listener.follow('full', function (e) {
    if (e.type === 'complite') {
        var btn = $(`<div class="full-start__button selector" data-subtitle="Kodik Only">
            <svg viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="64" cy="64" r="56" stroke="white" stroke-width="16"/>
                <path d="M90.5 64.3827L50 87.7654L50 41L90.5 64.3827Z" fill="white"/>
            </svg>
            <span>Kodik</span>
        </div>`);
        btn.on('hover:enter', function () {
            Lampa.Activity.push({
                url: '',
                title: 'Kodik',
                component: 'kodik_only',
                movie: e.data.movie,
                search: e.data.movie.title,
                page: 1
            });
        });
        e.object.activity.render().find('.view--torrent').after(btn);
    }
});

})();
