stk500
=========

[STK500](http://www.atmel.com/tools/stk500.aspx) javascript implementation for node and browserify

Fully javascript stk500v2 and stk500v1 programmer. Allows you to program Arduinos straight from node (or browser for that matter). No more avrdude system calls or using the arduino IDE.

###INSTALL
```
npm install stk500
```

####Program:

* this may not be true. anymore update before 1.0.0 release * 
You need an *unconnected* instance of (my fork of) Chris Williams's Node Serial Port at the correct speed for your chip (commonly 115200) with a raw parser.

```
var serialPort = new SerialPort.SerialPort(port.comName, {
  baudrate: 115200,
  parser: SerialPort.parsers.raw
}, false);

```

Then you can instantiate a programmer.

```
var stk500 = require('stk500');

var programmerv2 = stk500(serialPort);
// or for v1
var programmerv1 = stk500.v1(serialPort);


```

Beyond that you can send stk500 commands. For programming the process is a fairly strict series of async series including connect, reset, sync, setOptions (pagesize is the only necessary option), enterprogrammingmode, program, exitprogrammingmode, disconnect. See uno.js in examples.


###How to get a hex

You can compile by hand yourself with avrdude if you know your stuff, or you can just steal one from Arduino. First make sure you have verbosity enabled in your Arduino preferences: Arduino Preferences -> check Show verbose output during Compilation. Now when you build you'll see a ton of lines on screen. The last couple lines have what you need:
```
/var/folders/zp/bpw8zd0141j5zf7l8m_qtt8w0000gp/T/build6252696906929781517.tmp/Blink.cpp.hex 

Sketch uses 896 bytes (2%) of program storage space. Maximum is 32,256 bytes.
Global variables use 9 bytes (0%) of dynamic memory, leaving 2,039 bytes for local variables. Maximum is 2,048 bytes.
```
Grab that hex file and you're good to go.

###Gotchas
* Only works on MacOSX (and probably linux). Requires on Chris Williams excellent nodeserial implementation https://github.com/voodootikigod/node-serialport. However nodeserial doesn't currently support manual rts/dtr signaling so I have a fork with unix bindings https://github.com/jacobrosenthal/node-serialport/tree/controlsignals
* Since I'm forking nodeserial and not hosting a new version yet I've got a postinstall step that tries to run ./postinstall to kick off a fresh build.
* intel-hex and fs are dependancies only for the example file


###CHANGELOG
0.0.1 
first

0.0.2
Added loading from fs to example, some example hexes from arduino 1.0.6 for Uno, and instructions on how to find a hex file to load.

0.0.3
Bugs squashed leading to much more stable getsync and less attempts necessary to successfuly programmin. Slight refactor in example and clearer console.log messaging.

0.0.4
Slight require change for browserfy-ability and a few more touchups in example

0.0.5
Fixed instability issue especially in chrome where listeners were not being deregistered

0.0.6
Added ability to verify device signature.
