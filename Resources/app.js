// this sets the background color of the master UIView (when there are no windows/tab groups on it)
Titanium.UI.setBackgroundColor('#000');

// create tab group
var tabGroup = Titanium.UI.createTabGroup();


//
// create base UI tab and root window
//
var win = Titanium.UI.createWindow({  
    title:'宝探しクイズ！',
    //backgroundImage: '/images/cat.jpg',
//    layout: 'vertical',
    backgroundColor:'#fff',
    orientationModes: [Ti.UI.PORTRAIT]
});

var titleLabel = Titanium.UI.createLabel({
	text: '宝探しクイズ',
	font: {fontSize: 48},
	left: 0,
	top: 0,
	backgroundColor: '#000',
	width: '100%'
})

var mapImage = Ti.UI.createImageView({
	image: '/images/map01.png',
	width: '100%',
	height: '100%'
})

var button = Ti.UI.createButton({
	//title: 'ついた！',
	backgroundImage: '/images/button.png',
	width: '128',
	height: '128',
	bottom: '50'
})

var answerWin = Ti.UI.createWindow({
	title: '応えを入力せよ',
	layout: 'vertical',
	backgroundImage: '/images/demo02.png',
    backgroundColor:'#fff',
    orientationModes: [Ti.UI.PORTRAIT]
})
var label2 = Ti.UI.createLabel({
	text: '答え',
	font: {fontSize: 48},
	left: 0,
	top: 0,
	backgroundColor: '#000',
	width: '100%'
	})
answerWin.add(label2)
var textfield = Ti.UI.createTextField(
	{
		width: '100%'
	}
)
answerWin.add(textfield)

var answerButton = Ti.UI.createButton({
	title: '答えチェック！'
})
answerButton.addEventListener('click', function(){
		alert('はずれ！！')	
})
answerWin.add(answerButton)
var backButton = Ti.UI.createButton({title: '前の画面に戻る'})
backButton.addEventListener('click',function(){ answerWin.close()})
answerWin.add(backButton)																												

button.addEventListener('click', function(){
	answerWin.open()
})
win.add(titleLabel)
win.add(mapImage)
win.add(button)

var marker = Ti.UI.createImageView({
	image: '/images/human.png'
})

win.add(marker)

//geolocation
var lat =  35.000156;
var lon = 135.756723;
var latd = 0.008955 / 50;
var lond = 0.016512 / 50;
var lat1 = lat - latd / 2;
var lat2 = lat + latd / 2;
var lon1 = lon - lond / 2;
var lon2 = lon + lond / 2;

var x1 = 0;
var x2 = Ti.Platform.displayCaps.platformWidth;
var y1 = 0;
var y2 = Ti.Platform.displayCaps.platformHeight;

function update() {
//	Ti.API.info('update....')
	Ti.Geolocation.getCurrentPosition(function (e) {
	//	Ti.API.info('received geo response');
		if (e.error) {
			//$id.label.text = e.error;
		} else {
			var x = ((x2 - x1) * (e.coords.latitude  - lat1) / (lat2 - lat1));
			var y = ((y2 - y1) * (e.coords.longitude - lon1) / (lon2 - lon1));
//		Ti.API.info(e.coords.latitude)
//		Ti.API.info(e.coords.longitude)
			//$id.label.text
			// = '緯度: [ ' + lat1 + ' / ' + e.coords.latitude  + ' / ' + lat2 + ' ]\n'
			// + '経度: [ ' + lon1 + ' / ' + e.coords.longitude + ' / ' + lon2 + ' ]\n'
			// + 'Ｘ軸: [ ' + x1 + ' / ' + x + ' / ' + x2 + ' ]\n'
			// + 'Ｙ軸: [ ' + y1 + ' / ' + y + ' / ' + y2 + ' ] ';
			marker.left = x;
			marker.top = y;
		}
		setTimeout(update, 30000);
	});
};

//update();

win.addEventListener('open', function(){
	update();
})
win.open();

