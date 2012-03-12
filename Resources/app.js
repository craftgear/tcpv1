// fixed to portrait splash screen
// for iOS, see [ProjectHome]/tiapp.xml
// for Android, see [ProjectHome]/platform/android/AndroidManifest.xml from [ProjectHome]/build/android/AndroidManifest.xml(.gen)

// this sets the background color of the master UIView (when there are no windows/tab groups on it)
//Ti.UI.backgroundColor = '#000';	// no thanks hide splash screen
//if (Ti.Platform.osname == 'android') { Ti.UI.backgroundImage = '/default.png'; }

var modules ={};

modules.common = new function () {
	var self = this;

	self.fontSizeL = Ti.Platform.displayCaps.platformHeight * 0.07;
	self.fontSizeM = Ti.Platform.displayCaps.platformHeight * 0.05;
	self.fontSizeS = Ti.Platform.displayCaps.platformHeight * 0.02;

	var tid = null;
	var notifyDialog = (Ti.Platform.osname == 'android')
	 ? Ti.UI.createNotification({duration: Ti.UI.NOTIFICATION_DURATION_LONG})
	 : Ti.UI.createAlertDialog({title: 'Nortify'});
	self.notify = function (message) {
		notifyDialog.hide();
		notifyDialog.message = message;
		if (Ti.Platform.osname == 'android' && parseFloat(Ti.version) >= 1.8) {	// Ti.UI.Notification.setMessage 1.8+ not work
			notifyDialog = Ti.UI.createNotification({message: message, duration: Ti.UI.NOTIFICATION_DURATION_LONG});
		}
		notifyDialog.show();
		if (Ti.Platform.osname != 'android') {
			if (tid) { clearTimeout(tid); }
			tid = setTimeout(function () { notifyDialog.hide(); }, 3000);
		}
	};

	var exitConfirm = false;
	self.exit = function (confirm) {
		if (confirm && ! exitConfirm) {
			exitConfirm = true;
			setTimeout(function () { exitConfirm = false; }, 3000);
			self.notify('もう一度押すと終了します。');
		} else {
			notifyDialog.hide();
			modules.quest.window.close();
		}
	};

	var abortDialog = Ti.UI.createAlertDialog({title: 'Abort', buttonNames: ['OK']});
	self.abort = function (message) {
		if (! modules.quest.window.opened) {
			setTimeout(function () { self.abort(message); }, 500);
			return;
		}
		abortDialog.hide();
		abortDialog.message = message;
		abortDialog.addEventListener('click', function(e) { self.exit(); });
		abortDialog.show();
	};

	var confirmDialog = Ti.UI.createAlertDialog({title: 'Confirm', buttonNames: ['OK', 'Cancel'], cancel: 1});
	self.confirm = function (message, callback) {
		if (! modules.quest.window.opened) {
			setTimeout(function () { self.confirm(message, callback); }, 500);
			return;
		}
		confirmDialog.hide();
		confirmDialog.message = message;
		confirmDialog.addEventListener('click', function(e) { if (e.index == 0) { callback(); } });
		confirmDialog.show();
	};

	self.dist = function (lon1, lat1, lon2, lat2) {
		return Math.sqrt(Math.pow((lon1 - lon2) / 0.0091, 2) + Math.pow((lat1 - lat2) / 0.0111, 2));	// km
	};

	// for debug
	var format = function (f, v, v2) {
		return v ? String.format(f, v, v2) : '';
	};

	var formattime = function (time) {
		if (! time) { return ''; }
		var date = new Date();
		date.setTime(time);
		return String.format('%02.0f:%02.0f:%02.0f', date.getHours(), date.getMinutes(), date.getSeconds());	// '%d' is work, but '%2d' is not work 
	};

	// reverse geocoding
	var address = null;
	var alon = null;
	var alat = null;
	self.rgeocode = function (label, location, x, y) {
		var text
		 = format('座標:%d, %d\n', x, y)
		 + format('経度:%10.6f\n', location.longitude)
		 + format('緯度:%10.6f\n', location.latitude)
		 + format('高度:%6.2fm\n', location.altitude)
		 + format('精度:%6.2fm\n', location.accuracy)
		 + format('速度:%6.2fm/s\n', location.speed)
		 + format('方向:%6.2f°\n', location.heading)
		 + format('時刻:%s\n', formattime(location.timestamp));
		var lon = location.longitude;
		var lat = location.latitude;
		if (address && alon && alat && self.dist(lon, lat, alon, alat) * 1000 < 10) {
			label.text = text + '住所:キャッシュ\n' + String.format('%10.6f\n%10.6f\n', alon, alat) + address;
			return;
		}
		if (! Ti.Network.online) {
			label.text = text + '住所:オフライン';
			return;
		}
		var xhr = Ti.Network.createHTTPClient();
		xhr.onerror = function (e) {
			label.text = text + '住所:エラー\n' + e.error;
		};
		xhr.onload = function () {
			var result = JSON.parse(this.responseText).result;
			if (! result) {
				label.text = text + '住所:エラー';
				return;
			}
//			address = (result.prefecture ? result.prefecture.pname : '')
//			 + (result.municipality ? (' ' + result.municipality.mname) : '')
			address = (result.municipality ? result.municipality.mname : '')
			 + ((result.local && result.local[0]) ? ('\n' + result.local[0].section + result.local[0].homenumber) : '');
			alon = lon;
			alat = lat;
			label.text = text + address;
		};
		xhr.open('GET', 'http://www.finds.jp/ws/rgeocode.php?json&lat=' + lat + '&lon=' + lon);
		xhr.send();
	};
	// for debug
};

modules.quest = new function () {
	var self = this;
	self.__proto__ = modules.common;

	var wx = 0;	// imageview pos & size overwrite this in window open event
	var ex = 0;	// imageview pos & size overwrite this in window open event
	var ny = 0;	// imageview pos & size overwrite this in window open event
	var sy = 0;	// imageview pos & size overwrite this in window open event
	var gx = 0;	// imageview pos & size overwrite this in window open event
	var gy = 0;	// imageview pos & size overwrite this in window open event

	var mlocation = {longitude: 135.756723, latitude: 35.000156};	// coworking space Kowaki, first location event overwrite this for demo

	var marker = null;

	// for debug
	var debug = true;
	var debug_m = null;
	var debug_g = null;
	var debugnw = null;
	var debugsw = null;
	var debugne = null;
	var debugse = null;
	// for debug

	var window = self.window = Ti.UI.createWindow({
		isActivity: true,	// with Activity for Android Ti1.8+
		fullscreen: false,	// with Activity for Android Ti1.7- & statusBar on (see tiapp.xml if no need Activity)
		navBarHidden: true,	// with Activity for Android Ti1.7- & titleBar off (see tiapp.xml if no need Activity)
		exitOnClose: true,	// App exit by hardware back key for Android
		backgroundColor:'#fff',
//		title:'宝探しクイズ！',
//		orientationModes: [Ti.UI.PORTRAIT],
	});
	window.orientationModes = [Ti.UI.PORTRAIT];
	window.addEventListener('open', function (e) {
		// handle geolocation event listener after window.open() for Android Ti1.8+
		// because exception is thrown in window.open() if read window.activity before window.open()
		var receiver = (Ti.Platform.osname == 'android') ? window.activity : Ti.App;	// != Ti.Android.currentActivity
		var resumed = (Ti.Platform.osname == 'android') ? 'resume' : 'resumed';
		receiver.addEventListener(resumed, function (e) {
			Ti.API.info(resumed + ' fire');
			Ti.Geolocation.removeEventListener('location', modules.tsuita.locationCallback);
			Ti.Geolocation.addEventListener('location', modules.tsuita.locationCallback);
		});
		receiver.addEventListener('pause', function (e) {
			Ti.API.info('pause fire');
			Ti.Geolocation.removeEventListener('location', modules.tsuita.locationCallback);
		});
		Ti.Geolocation.getCurrentPosition(function (e) {
			modules.tsuita.handleLocation(e);	// not set e.devicetime
		});

		if (self.loadQuest) { self.loadQuest(self, mlocation); }

		var contentw = window.width;
		var contenth = window.height * 0.88;
		var adjustw = (contenth / self.imageh > contentw / self.imagew) ? contentw : (self.imagew * contenth / self.imageh);
		var adjusth = (contenth / self.imageh > contentw / self.imagew) ? (self.imageh * contentw / self.imagew) : contenth;
		wx = (contentw - adjustw) / 2;
		ex = (contentw + adjustw) / 2 - 1;
		ny = window.height - adjusth;
		sy = window.height - 1;
		gx = wx + self.goalx * adjustw / self.mapw;
		gy = ny + self.goaly * adjusth / self.maph;

		window.add(Ti.UI.createImageView({
			width: adjustw,
			height: adjusth,
			left: wx,
			top: ny,
			image: self.image,
		}));

		window.add(Ti.UI.createLabel({
			width: contentw,
			height: ny,
			left: 0,
			top: 0,
			backgroundColor: '#000',
			color: '#fff',
			textAlign: 'center',
			font: {fontSize: self.fontSizeL},
//			text: '宝探しクイズ',
			text: self.title,
		}));

		var tsuitaButton = Ti.UI.createImageView({
			width: self.tsuitaw * adjustw / self.mapw,
			height: self.tsuitah * adjusth / self.maph,
			left: gx - self.tsuitaw * adjustw / self.mapw / 2,
			top: gy,
			image: self.tsuitaImage,
		});
		tsuitaButton.addEventListener('click', function(e) {
			var area = self.areaw + self.areah;
			var dist = self.dist(mlocation.longitude, mlocation.latitude, self.glon, self.glat) * 1000;	// km => m
			if (dist < area * 0.02) {
				modules.answerDemo.main();	// ToDo: manage next module
			} else {
				alert((dist < area * 0.05) ? 'もうちょっとー' : 'まだー');
			}

			// for debug
			if (debug) {
				self.notify(String.format('%06.2fm\n%06.2fm\n%06.2fm', dist, area * 0.05, area * 0.02));
			}
			// for debug
		});
		window.add(tsuitaButton);

		marker = Ti.UI.createImageView({
			width: self.markerw * adjustw / self.mapw,
			height: self.markerh * adjusth / self.maph,
			image: self.markerImage,
		});
		window.add(marker);

		// for debug
		var createDebugLabel = function (opts) {
			label = Ti.UI.createLabel({
				width: 'auto',
				height: 'auto',
				opacity: 0.6,
				backgroundColor: '#fff',
				color: '#000',
				font: {fontSize: self.fontSizeS},
				text: 'for debug',
			});
			for (var n in opts) { label[n] = opts[n]; }
			label.addEventListener('click', function(e) {
				self.confirm('デバッグ表示を消しますか？', function () {
					debug = false;
					debug_m.hide();
					debug_g.hide();
					debugnw.hide();
					debugsw.hide();
					debugne.hide();
					debugse.hide();
				});
			});
			return label;
		}
		debug_m = createDebugLabel({right: wx, top: ny * 3});
		window.add(debug_m);
		debug_g = createDebugLabel({left: wx, bottom: (self.maph - self.goaly) * adjusth / self.maph});
		window.add(debug_g);
		debugnw = createDebugLabel({left: 0, top: ny});
		window.add(debugnw);
		debugsw = createDebugLabel({left: 0, bottom: 0});
		window.add(debugsw);
		debugne = createDebugLabel({right: 0, top: ny});
		window.add(debugne);
		debugse = createDebugLabel({right: 0, bottom: 0});
		window.add(debugse);
		// for debug

		window.opened = true;
	});
	window.addEventListener('close', function (e) {
		Ti.Geolocation.removeEventListener('location', modules.tsuita.locationCallback);
	});
	window.addEventListener('android:back', function (e) {
		self.exit(true);
	});

	// geolocation
	self.updateLocation = function (location) {
		if (! self.window.opened) {
			setTimeout(function () { self.updateLocation(location); }, 500);
			return;
		}
		mlocation = location;
		var mx = wx + ((ex - wx) * (mlocation.longitude - self.wlon) / (self.elon - self.wlon));
		var my = ny + ((sy - ny) * (mlocation.latitude - self.nlat) / (self.slat - self.nlat));
		if (marker) {
			marker.left = Math.max(wx, Math.min(ex, mx)) - marker.width / 2;
			marker.top = Math.max(ny, Math.min(sy, my)) - marker.height / 2;
		}

		// for debug
		if (debug) {
			self.rgeocode(debug_m, mlocation, mx, my);
		}
		// for debug
	};

	self.loadNextQuest = function (location) {
		if (! self.window.opened) {
			setTimeout(function () { self.loadNextQuest(location); }, 500);
			return;
		}
		if (location) { mlocation = location; }
		if (self.loadQuest) { self.loadQuest(self, mlocation); }
		self.updateLocation(mlocation);

		// for debug
		if (debug) { 
			self.rgeocode(debug_g, {longitude: self.glon, latitude: self.glat}, gx, gy);
			self.rgeocode(debugnw, {longitude: self.wlon, latitude: self.nlat}, wx, ny);
			self.rgeocode(debugsw, {longitude: self.wlon, latitude: self.slat}, wx, sy);
			self.rgeocode(debugne, {longitude: self.elon, latitude: self.nlat}, ex, ny);
			self.rgeocode(debugse, {longitude: self.elon, latitude: self.slat}, ex, sy);
		}
		// for debug
	};
};

modules.answer = new function () {
	var self = this;
	self.__proto__ = modules.common;

	var textfield = null;

	var window = self.window = Ti.UI.createWindow({
		isActivity: true,	// with Activity for Android Ti1.8+
		fullscreen: false,	// with Activity for Android Ti1.7- & statusBar on (see tiapp.xml if no need Activity or Ti1.8+)
		navBarHidden: true,	// with Activity for Android Ti1.7- & titleBar off (see tiapp.xml if no need Activity or Ti1.8+)
//		exitOnClose: false,	// App not exit by hardware back key for Android
		backgroundColor:'#fff',
//		title: '応えを入力せよ',
//		orientationModes: [Ti.UI.PORTRAIT],
	});
	window.orientationModes = [Ti.UI.PORTRAIT];
	window.addEventListener('open', function (e) {
		if (self.loadAnswer) { self.loadAnswer(self); }

		alert(self.title);

		if (textfield) { return; }

		var contentw = window.width;
		var contenth = window.height * 0.88;
		var adjustw = (contenth / self.imageh > contentw / self.imagew) ? contentw : (self.imagew * contenth / self.imageh);
		var adjusth = (contenth / self.imageh > contentw / self.imagew) ? (self.imageh * contentw / self.imagew) : contenth;
		var pad = (contentw - adjustw) / 2;

		window.add(Ti.UI.createImageView({
			width: adjustw,
			height: adjusth,
			left: pad,
			bottom: 0,
			image: self.image,
		}));

		window.add(Ti.UI.createLabel({
			width: contentw,
			height: window.height - contenth,
			left: 0,
			top: 0,
			backgroundColor: '#000',
			color: '#fff',
			textAlign: 'center',
			font: {fontSize: self.fontSizeL},
//			text: '答え',
			text: self.title,
		}));

		textfield = Ti.UI.createTextField({
			width: self.textfieldw * adjustw,
			height: self.textfieldh * adjusth,
			bottom: self.textfieldb * adjusth,
			backgroundColor: 'transparent',
//			backgroundColor: '#fff',
			textAlign: 'center',
			font: {fontSize: self.fontSizeM},
		});
		window.add(textfield);

		var backButton = Ti.UI.createView({
			width: self.backButtonw * adjustw,
			height: self.backButtonh * adjusth,
			left: self.backButtonl * adjustw + pad,
			bottom: self.backButtonb * adjusth ,
			backgroundColor: 'transparent',
//			backgroundColor: '#fff',
//			title: '前の画面に戻る',
		});
		backButton.addEventListener('click', function (e) {
			window.close();
		});
		window.add(backButton);

		var answerButton = Ti.UI.createView({
			width: self.answerButtonw * adjustw,
			height: self.answerButtonh * adjusth,
			right: self.answerButtonr * adjustw + pad,
			bottom: self.answerButtonb * adjusth,
			backgroundColor: 'transparent',
//			backgroundColor: '#fff',
//			title: '答えチェック！',
		});
		answerButton.addEventListener('click', function (e) {
			alert((textfield.value == self.answer) ? 'あたり！！' : 'はずれ！！');
		});
		window.add(answerButton);
	});
	window.addEventListener('close', function (e) {
		textfield.value = '';
		modules.quest.loadNextQuest();
	});
	window.addEventListener('android:back', function (e) {
		window.close();
	});
};

modules.quest1 = new function () {
	var self = this;
	self.__proto__ = modules.quest;

	self.loadQuest = function (self, location) {
		self.title = 'ついた？';

		// images
		self.image = '/images/map01.png';
		self.imagew = 320;
		self.imageh = 480;
		self.mapx = 0;	// ToDo: != 0
		self.mapy = 0;	// ToDo: != 0
		self.mapw = self.imagew;	// ToDo: != imagew
		self.maph = self.imageh;	// ToDo: != imageh
		self.goalx = 72;
		self.goaly = 350;
		self.tsuitaImage = '/images/button.png';
		self.tsuitaw = 116;
		self.tsuitah = 94;
		self.markerImage = '/images/human.png';
		self.markerw = 54;
		self.markerh = 54;
	
		// geo for release, set goal & field lon & lat, calc other
		self.glon = 135.756723;	// coworking space Kowaki
		self.glat = 35.000156;	// coworking space Kowaki
		self.wlon = 135.755932;														// West
		self.elon = self.wlon + self.mapw * (self.glon - self.wlon) / self.goalx;	// East
		self.nlat = 35.003309;														// North
		self.slat = self.nlat - self.maph * (self.nlat - self.glat) / self.goaly;	// South
		self.clon = (self.wlon + self.elon) / 2;
		self.clat = (self.nlat + self.slat) / 2;
		self.lond = self.elon - self.wlon;
		self.latd = self.nlat - self.slat;
		self.areaw = self.lond * 32598288 / 360;
		self.areah = self.latd * 40008000 / 360;
	}

	self.main = function () {
		modules.quest.loadQuest = self.loadQuest;
		self.window.open();
	};
};

modules.questDemo = new function () {
	var self = this;
	self.__proto__ = modules.quest;

	self.loadQuest = function (self, location) {
		self.title = 'ついた？';

		// images
		self.image = '/images/map01.png';
		self.imagew = 320;
		self.imageh = 480;
		self.mapx = 0;	// ToDo: != 0
		self.mapy = 0;	// ToDo: != 0
		self.mapw = self.imagew;	// ToDo: != imagew
		self.maph = self.imageh;	// ToDo: != imageh
		self.goalx = 72;
		self.goaly = 350;
		self.tsuitaImage = '/images/button.png';
		self.tsuitaw = 116;
		self.tsuitah = 94;
		self.markerImage = '/images/human.png';
		self.markerw = 54;
		self.markerh = 54;
	
		// geo for demo, set field distance, set center from first GPS result, calc other
		self.areaw = self.mapw * 1.0;	// 320m (see aspect ratio of map image)
		self.areah = self.maph * 1.0;	// 480m (see aspect ratio of map image)
		self.lond = self.areaw * 360 / 32598288;	// ° = m * 360° / 40075km * cos(latitude)
		self.latd = self.areah * 360 / 40008000;	// ° = m * 360° / 40008km
		self.clon = location.longitude;
		self.clat = location.latitude;
		self.wlon = self.clon - self.lond / 2;
		self.elon = self.clon + self.lond / 2;
		self.nlat = self.clat + self.latd / 2;
		self.slat = self.clat - self.latd / 2;
		self.glon = self.wlon + self.lond * self.goalx / self.mapw;
		self.glat = self.nlat - self.latd * self.goaly / self.maph;
	}

	self.main = function () {
		modules.quest.loadQuest = self.loadQuest;
		self.window.open();
	};
};

modules.answerDemo = new function () {
	var self = this;
	self.__proto__ = modules.answer;

	self.loadAnswer = function (self) {
		self.title = 'ついた！';
		self.answer = 'せいかい';

		// image
		self.image = '/images/demo02.png';
		self.imagew = 320;
		self.imageh = 480;
		self.textfieldw = 0.85;
		self.textfieldh = 0.10;
		self.textfieldb = 0.20;
		self.backButtonw = 0.40;
		self.backButtonh = 0.10;
		self.backButtonl = 0.06;
		self.backButtonb = 0.07;
		self.answerButtonw = 0.40;
		self.answerButtonh = 0.10;
		self.answerButtonr = 0.06;
		self.answerButtonb = 0.07;
	}

	self.main = function () {
		modules.answer.loadAnswer = self.loadAnswer;
		self.window.open();
	};
};

modules.tsuita = new function () {
	var self = this;
	self.__proto__ = modules.common;

	var lasttime = null;
	self.handleLocation = function (e) {
		if (! e.success || e.error) {
			self.notify('現在地を確認できません。' + ((e.error && e.error.message) ? ('\n' + e.error.message) : ''));
		} else if (! lasttime) {
			lasttime = e.devicetime;
			modules.quest.loadNextQuest(e.coords);
		} else if (e.devicetime) {
			modules.quest.updateLocation(e.coords);
		}
	};

	self.locationCallback = function (e) {
//		Ti.API.info('location fire');
		e.devicetime = (new Date()).getTime();	// GPS time != device time
		self.handleLocation(e);
	}

/*

Ti:getCurrentPosition == Android:getLastKnownLocation
GPS location is not update w/o add location event or run other GPS App (e.g. GPS Logger)

	var pollLocation = function () {
		Ti.Geolocation.getCurrentPosition(function (e) {
			modules.quest.handleLocation(e);
			setTimeout(pollLocation, 10000);
		});
	};
*/

	if (! Ti.Geolocation.locationServicesEnabled) {
		self.abort('現在地を確認できません。\n設定で位置情報が禁止されているか、\n位置情報機能を持たない機種です。');
		return;
	}
	Ti.Geolocation.purpose = 'ついた！の確認と、マップ上の現在地表示のため';	// for iOS4+
	Ti.Geolocation.preferredProvider = Ti.Geolocation.PROVIDER_GPS;	// for Android
	Ti.Geolocation.frequency = 1;	// for Android
	Ti.Geolocation.accuracy = Ti.Geolocation.ACCURACY_BEST;
//	Ti.Geolocation.showCalibration = false;
	Ti.Geolocation.removeEventListener('location', self.locationCallback);
	Ti.Geolocation.addEventListener('location', self.locationCallback);
/*

handle geolocation event listener after window.open() for Android Ti1.8+
because exception is thrown in window.open() if read window.activity before window.open()

	var receiver = (Ti.Platform.osname == 'android') ? modules.quest.window.activity : Ti.App;	// != Ti.Android.currentActivity
	var resumed = (Ti.Platform.osname == 'android') ? 'resume' : 'resumed';
	receiver.addEventListener(resumed, function (e) {
		Ti.API.info(resumed + ' fire');
		Ti.Geolocation.removeEventListener('location', self.locationCallback);
		Ti.Geolocation.addEventListener('location', self.locationCallback);
	});
	receiver.addEventListener('pause', function (e) {
		Ti.API.info('pause fire');
		Ti.Geolocation.removeEventListener('location', self.locationCallback);
	});
	Ti.Geolocation.getCurrentPosition(function (e) {
		self.handleLocation(e);	// not set e.devicetime
	});
*/
	setTimeout(function () {
		if (! lasttime) {　self.abort('現在地を確認できません。\n上空がよく見通せる屋外で再度試してください。\n電源オフ・オンで改善することもあります。');　}
	}, 90000);	// check timeout by App because Android OS GPS location event is not timeout
//	if (Ti.Platform.osname == 'android') { pollLocation(); }
//	modules.questDemo.main();
	setTimeout(function () { modules.questDemo.main(); }, 3000);
};
