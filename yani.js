(function () {
'use strict';

// === РАБОЧИЕ ТОКЕНЫ И НАСТРОЙКИ ===
var KODIK_TOKEN = '41dd95f84c21719b09d6c71182237a25'; // рабочий токен Kodik
var COLLAPS_PREFER_DASH = false; // false = HLS, true = DASH

function component(object) {
    var network = new Lampa.Reguest();
    var scroll = new Lampa.Scroll({ mask: true, over: true });
    var files = new Lampa.Explorer(object);
    var filter = new Lampa.Filter(object);

    var select_title = '';
    var current_balancer = Lampa.Storage.get('kodik_collaps_balancer', 'kodik'); // kodik или collaps
    var extract = {};
    var initialized = false;
    var self = this;

    // === МЕТОДЫ ЖИЗНЕННОГО ЦИКЛА ===

    this.create = function () {
        scroll.body().addClass('torrent-list');
        files.appendHead(filter.render());
        files.appendFiles(scroll.render());

        filter.onBack = function () { Lampa.Activity.backward(); };
        filter.onSelect = function (type, a, b) {
            if (a.reset) {
                self.reset();
            } else if (a.stype === 'source') {
                current_balancer = ['kodik', 'collaps'][b.index];
                Lampa.Storage.set('kodik_collaps_balancer', current_balancer);
                self.reset();
                self.search();
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
        select_title = object.search || object.movie.title;
        var kp_id = object.movie.kinopoisk_id ? parseInt(object.movie.kinopoisk_id) : 0;
        var imdb_id = object.movie.imdb_id || '';

        if (current_balancer === 'kodik') {
            self.searchKodik(kp_id, imdb_id);
        } else if (current_balancer === 'collaps') {
            self.searchCollaps(kp_id, imdb_id);
        }
    };

    this.reset = function () {
        scroll.clear();
        this.loading(true);
        this.search();
    };

    // === KODIK ===

    this.searchKodik = function (kp_id, imdb_id) {
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
                    self.fetchKodikFullInfo(mediaMap[firstId][0]);
                    return;
                }
            }
            self.emptyForQuery(select_title);
        }, function () {
            self.emptyForQuery(select_title);
        });
    };

    this.fetchKodikFullInfo = function (media) {
        var params = 'token=' + KODIK_TOKEN + '&limit=100&with_episodes=true';
        if (media.shikimori_id) params += '&shikimori_id=' + media.shikimori_id;
        else if (media.worldart_link) params += '&worldart_link=' + encodeURIComponent(media.worldart_link);
        else if (media.kinopoisk_id) params += '&kinopoisk_id=' + media.kinopoisk_id;
        else if (media.imdb_id) params += '&imdb_id=' + encodeURIComponent(media.imdb_id);
        else if (media.id) params += '&id=' + media.id;
        else return self.emptyForQuery(select_title);

        network.timeout(10000);
        network.native('https://kodikapi.com/search?' + params, function (json) {
            if (json && json.results) {
                self.extractKodikData(json.results);
                self.applyFilter('kodik');
                self.renderItems('kodik', self.filtredKodik());
                self.loading(false);
            } else {
                self.emptyForQuery(select_title);
            }
        }, function () {
            self.emptyForQuery(select_title);
        });
    };

    this.extractKodikData = function (items) {
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
        extract.kodik = { items: items, seasons: seasons };
    };

    this.filtredKodik = function () {
        var items = [];
        var data = extract.kodik;
        if (data.seasons.length) {
            var season_id = data.seasons[choice.season]?.id;
            var voice = filter_items.voice[choice.voice];
            if (voice) {
                var translation = data.items.find(c =>
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
                            link: episodes[ep],
                            balancer: 'kodik'
                        });
                    }
                }
            }
        } else {
            data.items.forEach(c => {
                if (!c.seasons) {
                    items.push({
                        title: c.translation?.title || select_title,
                        quality: c.quality || '360p ~ 1080p',
                        info: '',
                        link: c.link,
                        balancer: 'kodik'
                    });
                }
            });
        }
        return items;
    };

    // === COLLAPS ===

    this.searchCollaps = function (kp_id, imdb_id) {
        var api = (kp_id ? 'kp/' : 'imdb/') + (kp_id || imdb_id);
        var prox = '';
        var base = 'api.namy.ws';
        var host = 'https://' + base;
        var ref = host + '/';
        var user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
        var embed = (false ? 'http:' : 'https:') + '//' + base + '/embed/';
        var headers = Lampa.Platform.is('android') ? {
            'User-Agent': user_agent,
            'Origin': host,
            'Referer': ref
        } : {};

        network.timeout(10000);
        network.native(embed + api, function (str) {
            self.parseCollaps(str || '');
        }, function () {
            if (!object.clarification && object.movie.imdb_id && kp_id != object.movie.imdb_id) {
                self.searchCollaps(0, object.movie.imdb_id);
            } else {
                self.emptyForQuery(select_title);
            }
        }, false, { dataType: 'text', headers: headers });
    };

    this.parseCollaps = function (str) {
        str = (str || '').replace(/\n/g, '');
        var find = str.match(/makePlayer\(({.*?})\);/);
        var json;
        try {
            json = find && (0, eval)('"use strict"; (' + find[1] + ');');
        } catch (e) {}
        if (json) {
            extract.collaps = json;
            if (extract.collaps.playlist && extract.collaps.playlist.seasons) {
                extract.collaps.playlist.seasons.sort(function (a, b) {
                    return a.season - b.season;
                });
            }
            self.applyFilter('collaps');
            self.renderItems('collaps', self.filtredCollaps());
            self.loading(false);
        } else {
            self.emptyForQuery(select_title);
        }
    };

    this.filtredCollaps = function () {
        var filtred = [];
        var data = extract.collaps;
        if (data.playlist) {
            data.playlist.seasons.forEach(function (season, i) {
                if (i == choice.season) {
                    season.episodes.forEach(function (episode) {
                        var audio_tracks = episode.audio.names.map(function (name) {
                            return { language: name };
                        });
                        var audio_infos = episode.audio.names.map(function (name, index) {
                            var order = episode.audio.order && episode.audio.order[index];
                            return { name: name, order: order != null ? order : 1000 };
                        });
                        audio_infos.sort(function (a, b) { return a.order - b.order; });
                        var audio_names = audio_infos.map(function (a) { return a.name; }).filter(function (name) { return name && name !== 'delete'; });
                        var file = self.fixLinkProtocol(COLLAPS_PREFER_DASH && (episode.dasha || episode.dash) || episode.hls || '', false, true);
                        filtred.push({
                            title: episode.title,
                            quality: '360p ~ ' + (COLLAPS_PREFER_DASH ? '1080p' : '720p'),
                            info: audio_names.length ? ' / ' + self.uniqueNamesShortText(audio_names, 80) : '',
                            season: season.season,
                            episode: parseInt(episode.episode),
                            file: file,
                            subtitles: episode.cc ? episode.cc.map(function (c) {
                                var url = self.fixLinkProtocol(c.url || '', false, true);
                                return { label: c.name, url: self.processSubs(url) };
                            }) : false,
                            audio_tracks: audio_tracks.length ? audio_tracks : false,
                            balancer: 'collaps'
                        });
                    });
                }
            });
        } else if (data.source) {
            var max_quality = 0;
            data.qualityByWidth && Lampa.Arrays.getKeys(data.qualityByWidth).forEach(function (resolution) {
                var quality = data.qualityByWidth[resolution] || 0;
                if (!COLLAPS_PREFER_DASH && quality > 720) quality = 0;
                if (quality > max_quality) max_quality = quality;
            });
            var audio_tracks = data.source.audio.names.map(function (name) { return { language: name }; });
            var audio_infos = data.source.audio.names.map(function (name, index) {
                var order = data.source.audio.order && data.source.audio.order[index];
                return { name: name, order: order != null ? order : 1000 };
            });
            audio_infos.sort(function (a, b) { return a.order - b.order; });
            var audio_names = audio_infos.map(function (a) { return a.name; }).filter(function (name) { return name && name !== 'delete'; });
            var file = self.fixLinkProtocol(COLLAPS_PREFER_DASH && (data.source.dasha || data.source.dash) || data.source.hls || '', false, true);
            filtred.push({
                title: data.title || select_title,
                quality: max_quality ? max_quality + 'p' : '360p ~ ' + (COLLAPS_PREFER_DASH ? '1080p' : '720p'),
                info: audio_names.length ? ' / ' + self.uniqueNamesShortText(audio_names, 80) : '',
                file: file,
                subtitles: data.source.cc ? data.source.cc.map(function (c) {
                    var url = self.fixLinkProtocol(c.url || '', false, true);
                    return { label: c.name, url: self.processSubs(url) };
                }) : false,
                audio_tracks: audio_tracks.length ? audio_tracks : false,
                balancer: 'collaps'
            });
        }
        return filtred;
    };

    // === ОБЩИЕ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

    this.applyFilter = function (balancer) {
        filter_items = { season: [], voice: [] };
        choice = { season: 0, voice: 0 };

        if (balancer === 'kodik') {
            var data = extract.kodik;
            filter_items.season = data.seasons.map(s => s.title);
            if (filter_items.season.length) {
                var season_id = data.seasons[choice.season]?.id;
                data.items.forEach(c => {
                    if (c.seasons?.[season_id] && c.translation) {
                        if (!filter_items.voice.some(v => v.id === c.translation.id)) {
                            filter_items.voice.push({ id: c.translation.id, title: c.translation.title });
                        }
                    }
                });
            }
        } else if (balancer === 'collaps') {
            var pl = extract.collaps.playlist;
            if (pl && pl.seasons) {
                filter_items.season = pl.seasons.map(s => Lampa.Lang.translate('torrent_serial_season') + ' ' + s.season);
            }
            // Collaps не имеет фильтрации по озвучке в этом UI — пропускаем
        }

        var sources = [
            { title: 'Kodik', selected: current_balancer === 'kodik' },
            { title: 'Collaps', selected: current_balancer === 'collaps' }
        ];

        var select = [{ title: Lampa.Lang.translate('torrent_parser_reset'), reset: true }];
        select.push({
            title: Lampa.Lang.translate('settings_rest_source'),
            subtitle: current_balancer === 'kodik' ? 'Kodik' : 'Collaps',
            items: sources.map((s, i) => ({ title: s.title, selected: s.selected, index: i })),
            stype: 'source'
        });

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
    };

    var lastItem = null;
    var filter_items = {};
    var choice = { season: 0, voice: 0 };

    this.renderItems = function (balancer, items) {
        scroll.clear();
        var viewed = Lampa.Storage.cache('kodik_collaps_view', 5000, []);
        var last_episode = this.getLastEpisode(items);

        items.forEach(function (element) {
            if (element.season) {
                element.translate_episode_end = last_episode;
            }
            var hash = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('') : object.movie.original_title);
            var view = Lampa.Timeline.view(hash);
            var item = Lampa.Template.get('online_mod', element);
            var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, element.title, balancer].join('') : object.movie.original_title + element.title + balancer);
            element.timeline = view;
            item.append(Lampa.Timeline.render(view));
            if (Lampa.Timeline.details) {
                item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
            }
            if (viewed.indexOf(hash_file) !== -1) {
                item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
            }
            item.on('hover:enter', function () {
                if (element.loading) return;
                if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
                element.loading = true;

                if (balancer === 'kodik') {
                    self.getStreamKodik(element, function (element) {
                        self.playElement(element, items, balancer);
                    }, function () {
                        element.loading = false;
                        Lampa.Noty.show(Lampa.Lang.translate('online_mod_nolink'));
                    });
                } else if (balancer === 'collaps') {
                    element.stream = element.file;
                    element.qualitys = false;
                    self.playElement(element, items, balancer);
                }
            });
            scroll.append(item);
            lastItem = item[0];
        });
        self.loading(false);
    };

    this.playElement = function (element, items, balancer) {
        element.loading = false;
        var first = {
            url: balancer === 'kodik' ? self.getDefaultQuality(element.qualitys, element.stream) : element.stream,
            quality: balancer === 'kodik' ? self.renameQualityMap(element.qualitys) : false,
            subtitles: element.subtitles || false,
            timeline: element.timeline,
            title: element.season ? element.title : select_title + (element.title == select_title ? '' : ' / ' + element.title)
        };

        if (element.season && Lampa.Platform.version) {
            var playlist = [];
            items.forEach(function (elem) {
                if (elem == element) {
                    playlist.push(first);
                } else {
                    var cell = {
                        url: function (call) {
                            if (balancer === 'kodik') {
                                self.getStreamKodik(elem, function (elem) {
                                    cell.url = self.getDefaultQuality(elem.qualitys, elem.stream);
                                    cell.quality = self.renameQualityMap(elem.qualitys);
                                    cell.subtitles = elem.subtitles;
                                    call();
                                }, function () { cell.url = ''; call(); });
                            } else {
                                cell.url = elem.file;
                                call();
                            }
                        },
                        timeline: elem.timeline,
                        title: elem.title
                    };
                    playlist.push(cell);
                }
            });
            Lampa.Player.playlist(playlist);
        } else {
            Lampa.Player.playlist([first]);
        }
        Lampa.Player.play(first);

        var viewed = Lampa.Storage.cache('kodik_collaps_view', 5000, []);
        var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, element.title, balancer].join('') : object.movie.original_title + element.title + balancer);
        if (viewed.indexOf(hash_file) == -1) {
            viewed.push(hash_file);
            Lampa.Storage.set('kodik_collaps_view', viewed);
        }
    };

    // === Kodik stream extraction ===
    this.getStreamKodik = function (element, call, error) {
        if (!element.link) return error();
        var url = element.link.replace(/^\/\//, 'https://');

        network.timeout(10000);
        network.native(url, function (html) {
            var match = html.match(/\burlParams = '([^']+)'/);
            if (!match) return error();

            try {
                var params = JSON.parse(match[1]);
                var videoMatch = html.match(/videoInfo\.(type|hash|id) = '([^']+)'/g);
                if (!videoMatch || videoMatch.length < 3) return error();

                var type = '', hash = '', id = '';
                videoMatch.forEach(m => {
                    var parts = m.split(" = '");
                    if (parts[0].includes('type')) type = parts[1].slice(0, -1);
                    if (parts[0].includes('hash')) hash = parts[1].slice(0, -1);
                    if (parts[0].includes('id')) id = parts[1].slice(0, -1);
                });

                var playerMatch = html.match(/<script[^>]*src="([^"]*app\.player_single[^"]*)"/);
                if (!playerMatch) return error();

                var playerUrl = url.split('/').slice(0, 3).join('/') + playerMatch[1];
                network.timeout(10000);
                network.native(playerUrl, function (playerJs) {
                    var infoMatch = playerJs.match(/url:\s*atob\("([^"]+)"\)/);
                    if (!infoMatch) return error();

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
                                        element.stream = src;
                                        element.qualitys = {};
                                        qualities.forEach(q => {
                                            if (resp.links[q] && resp.links[q][0]) {
                                                var qsrc = resp.links[q][0].src;
                                                try {
                                                    qsrc = atob(qsrc.replace(/[a-zA-Z]/g, x =>
                                                        String.fromCharCode((x <= 'Z' ? 90 : 122) >= (x = x.charCodeAt(0) + 13) ? x : x - 26)
                                                    ));
                                                } catch (e) {}
                                                element.qualitys[q + 'p'] = qsrc;
                                            }
                                        });
                                        call(element);
                                        return;
                                    }
                                }
                            }
                            error();
                        }, error);
                    } catch (e) { error(); }
                }, error);
            } catch (e) { error(); }
        }, error, false, { dataType: 'text' });
    };

    // === Утилиты ===
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

    this.getLastEpisode = function (items) {
        var last_episode = 0;
        items.forEach(function (e) {
            if (typeof e.episode !== 'undefined') last_episode = Math.max(last_episode, parseInt(e.episode));
        });
        return last_episode;
    };

    this.fixLinkProtocol = function (link, prefer_http, replace_protocol) {
        if (link) {
            if (link.startsWith('//')) {
                return (prefer_http ? 'http:' : 'https:') + link;
            } else if (prefer_http && replace_protocol) {
                return link.replace('https://', 'http://');
            } else if (!prefer_http && replace_protocol === 'full') {
                return link.replace('http://', 'https://');
            }
        }
        return link;
    };

    this.processSubs = function (url) { return url; };

    this.uniqueNamesShortText = function (names, limit) {
        var unique = names.filter((v, i, a) => a.indexOf(v) === i);
        if (limit && unique.length > 1) {
            var length = 0, limit_index = -1, last = unique.length - 1;
            unique.forEach((name, i) => {
                length += name.length;
                if (limit_index == -1 && length > limit - (i == last ? 0 : 5)) limit_index = i;
                length += 2;
            });
            if (limit_index != -1) {
                unique = unique.slice(0, Math.max(limit_index, 1));
                unique.push('...');
            }
        }
        return unique.join(', ');
    };

    this.getDefaultQuality = function (qualityMap, defValue) {
        if (qualityMap) {
            var preferably = Lampa.Storage.get('video_quality_default', '1080') + 'p';
            if (preferably === '1080p') preferably = '1080p Ultra';
            var items = ['2160p', '1440p', '1080p Ultra', '1080p', '720p', '480p'];
            var idx = items.indexOf(preferably);
            if (idx !== -1) {
                for (var i = idx; i < items.length; i++) {
                    if (qualityMap[items[i]]) return qualityMap[items[i]];
                }
                for (var i = idx - 1; i >= 0; i--) {
                    if (qualityMap[items[i]]) return qualityMap[items[i]];
                }
            }
        }
        return defValue;
    };

    this.renameQualityMap = function (qualityMap) {
        if (!qualityMap) return qualityMap;
        var renamed = {};
        for (var label in qualityMap) {
            renamed["\u200B" + label] = qualityMap[label];
        }
        return renamed;
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
    torrent_parser_reset: { ru: 'Сбросить', en: 'Reset' },
    settings_rest_source: { ru: 'Источник', en: 'Source' }
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

// === РЕГИСТРАЦИЯ ===
Lampa.Component.add('kodik_collaps', component);

Lampa.Manifest.plugins = {
    type: 'video',
    version: '1.1',
    name: 'Kodik + Collaps',
    description: 'Прямой поиск через Kodik и Collaps',
    component: 'kodik_collaps',
    onContextMenu: function (obj) {
        return { name: 'Смотреть на Kodik/Collaps', description: '' };
    },
    onContextLauch: function (obj) {
        Lampa.Activity.push({
            url: '',
            title: 'Kodik/Collaps',
            component: 'kodik_collaps',
            movie: obj,
            search: obj.title,
            page: 1
        });
    }
};

Lampa.Listener.follow('full', function (e) {
    if (e.type === 'complite') {
        var btn = $(`<div class="full-start__button selector" data-subtitle="Kodik + Collaps">
            <svg viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="64" cy="64" r="56" stroke="white" stroke-width="16"/>
                <path d="M90.5 64.3827L50 87.7654L50 41L90.5 64.3827Z" fill="white"/>
            </svg>
            <span>Kodik/Collaps</span>
        </div>`);
        btn.on('hover:enter', function () {
            Lampa.Activity.push({
                url: '',
                title: 'Kodik/Collaps',
                component: 'kodik_collaps',
                movie: e.data.movie,
                search: e.data.movie.title,
                page: 1
            });
        });
        e.object.activity.render().find('.view--torrent').after(btn);
    }
});

})();
