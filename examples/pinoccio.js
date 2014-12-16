
var stk500 = require('../');
var serialport = require('serialport');
var intel_hex = require('intel-hex');
var fs = require('fs');

var data = fs.readFileSync(__dirname+'/../../panda-attack/bootstrap.hex')+'';
var hex = intel_hex.parse(data).data;


//var pageSize = 256;
var baud = 115200;
//var delay1 = 10;
//var delay2 = 1;
/*
var signature = new Buffer([0x1e, 0x98, 0x01]);

var options = {
  timeout:0xc8,
  stabDelay:0x64,
  cmdexeDelay:0x19,
  synchLoops:0x20,
  byteDelay:0x00,
  pollValue:0x53,
  pollIndex:0x03
};
*/

var comName = '/dev/ttyACM0';

var serialPort = new serialport.SerialPort(comName, {
  baudrate: baud,
  parser: serialport.parsers.raw
}, function(){
  console.log('opened!',serialPort.opened);
  console.log(serialPort);
});

var flasher = stk500(serialPort);

flasher.parser.on('rawinput',function(buf){
  console.log("->",buf.toString('hex'));
})

flasher.parser.on('raw',function(buf){
  console.log("<-",buf.toString('hex'));
})

flasher.sync(2,function(err,data){
  console.log('callback',err," ",data)
})
