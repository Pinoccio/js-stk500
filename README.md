js-stk500
=========

[STK500](http://www.atmel.com/tools/stk500.aspx) javascript implementation for node and browserify

It's not there yet, but the goals are:

* Use browserify so it can be put into NPM and can be used either via node or browser
* Get it cleaned up and working for any chip, not just the 256RFR2.
* Merge Serial.js and Serial2.js, (Serial.js was for Chrome version <= 33, Serial2.js > 33)
* Ensure both STK500 and STK500v2 work (right now it's only tested with STK500v2)
