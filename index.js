/*https://dev.maxmind.com/geoip/legacy/csv/

http://maxmind.github.io/MaxMind-DB/

https://dev.maxmind.com/geoip/geoip2/geolite2/

https://dev.maxmind.com/minfraud/

"\xab\xcd\xefMaxMind.com"

transform in hex :
*/

var fs = require('fs');

var METADATA_START_MARKER = new Buffer('ABCDEF4D61784D696E642E636F6D', 'hex');

var IDX_DB_CITY = 'GeoLite2-City.mmdb';

var buffer = fs.readFileSync('DB\\20151116\\GeoLite2-City.mmdb',  {

});

// The maximum allowable size for the metadata section, including the marker that starts the metadata, is 128kb.


var size = buffer.length;

function findMetadataStart(file) {
    var found = 0,
        mlen = METADATA_START_MARKER.length - 1,
        fsize = file.length - 1
        ;

    console.log(mlen);
    while (found <= mlen && fsize-- > 0) {
        found += (file[fsize] === METADATA_START_MARKER[mlen - found]) ? 1 : -found;
    }
    console.log(found);
    return fsize + found;
};

function read(offset, numberOfBytes) {
    var buf;

    if (numberOfBytes === 0) {
        return new Buffer(0);
    }

    if (numberOfBytes === 1) {
        return new Buffer([buffer[offset]]);
    }

    buf = new Buffer(numberOfBytes);
    buf.fill(0);

    buffer.copy(buf, 0, offset, offset + numberOfBytes);

    return buf;
};

function decodeUint16(bytes) {
    return decodeUint32(bytes);
};

function decodeInt32(bytes) {
    return bytes.readInt32BE(0, true);
};

function decodeString(bytes) {
    return bytes.toString('utf8');
};

function decodeUint32(bytes) {
    var buffer = new Buffer(4);

    buffer.fill(0);
    bytes.copy(buffer, 4 - bytes.length);

    return buffer.readUInt32BE(0, true);
};

function decodeByType(type, offset, size) {
  var newOffset = offset + size,
      bytes = read(offset, size);

  switch (type) {
    /*case 'map':
        return this.decodeMapSync(size, offset);
    case 'array':
        return this.decodeArraySync(size, offset);
    case 'boolean':
        return [this.decodeBoolean(size), offset];*/
    case 'utf8_string':
        return [decodeString(bytes), newOffset];
  /*  case 'double':
        return [this.decodeDouble(bytes), newOffset];
    case 'float':
        return [this.decodeFloat(bytes), newOffset];
    case 'bytes':
        return [bytes, newOffset];*/
    case 'uint16':
        return [decodeUint16(bytes), newOffset];
    case 'uint32':
        return [decodeUint32(bytes), newOffset];
   /* case 'int32':
        return [this.decodeInt32(bytes), newOffset];
    case 'uint64':
        return [this.decodeUint64(bytes), newOffset];
    case 'uint128':
        return [this.decodeUint128(bytes), newOffset];*/
    default:
        throw new Error("MaxmindDBReader: Unknown or unexpected type: " + type + ' at offset:' + offset);
  }
};


// https://github.com/PaddeK/node-maxmind-db/blob/master/lib/Decoder.js
function decode() {

}

var start = findMetadataStart(buffer);

var types =  [
    'extended',         //  0
    'pointer',          //  1
    'utf8_string',      //  2
    'double',           //  3
    'bytes',            //  4
    'uint16',           //  5
    'uint32',           //  6
    'map',              //  7
    'int32',            //  8
    'uint64',           //  9
    'uint128',          // 10
    'array',            // 11
    'container',        // 12
    'end_marker',       // 13
    'boolean',          // 14
    'float'             // 15
];

var ctrlByte = buffer[start],
    type = types[ctrlByte >> 5],
    size = ctrlByte & 0x1f;

var mapSize = size;

// MAP Metadata
/*console.log(type);
console.log(size);*/
start += 1;

for (var i = 0; i<mapSize; i++) {
   ctrlByte = buffer[start],

   type = types[ctrlByte >> 5],
   size = ctrlByte & 0x1f;

  // MAP key one
  console.log('ctrlByte ' + ctrlByte);
  console.log('data type ' + type);
  console.log('size ' + size);

  start += 1;


  var content = decodeByType(type, start, size);
  console.log(content);

  start += size;

}

