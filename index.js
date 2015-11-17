/*https://dev.maxmind.com/geoip/legacy/csv/

http://maxmind.github.io/MaxMind-DB/

https://dev.maxmind.com/geoip/geoip2/geolite2/

https://dev.maxmind.com/minfraud/

"\xab\xcd\xefMaxMind.com"

transform in hex :
*/

var fs = require('fs');

var IPParser = require('./IPParser');

var Metadata = require('./Metadata');

var bigInt = require('big-integer');

var DATA_SECTION_SEPARATOR_SIZE = 16;

var METADATA_START_MARKER = new Buffer('ABCDEF4D61784D696E642E636F6D', 'hex');

var IDX_DB_CITY = 'GeoLite2-City.mmdb';

var pointerValueOffset = [0, 0, 2048, 526336, 0];

var buffer = fs.readFileSync('DB\\20151116\\GeoLite2-City.mmdb',  {

});

/*var buffer = fs.readFileSync('DB\\20151116\\GeoLite2-Country.mmdb',  {

});*/

var pointerBase = pointerBase || 0;

// The maximum allowable size for the metadata section, including the marker that starts the metadata, is 128kb.


var size = buffer.length;

function findMetadataStart(file) {
    var found = 0,
        mlen = METADATA_START_MARKER.length - 1,
        fsize = file.length - 1
        ;

    while (found <= mlen && fsize-- > 0) {
        found += (file[fsize] === METADATA_START_MARKER[mlen - found]) ? 1 : -found;
    }
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

function decodeBoolean(size) {
    return (size !== 0);
};

function decodeDouble(bits) {
    return bits.readDoubleBE(0, true);
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

function decodeUint64(bytes) {
    return decodeBigUint(bytes, 8);
};

function decodeUint128(bytes) {
    return decodeBigUint(bytes, 16);
};

function decodeBigUint(bytes, size) {
    var buffer,
        i = 0,
        integer = 0,
        numberOfLongs = size / 4
        ;

    buffer = new Buffer(size);
    buffer.fill(0);
    bytes.copy(buffer, size - bytes.length);

    for (i; i < numberOfLongs; i++) {
        integer = bigInt(integer).multiply(4294967296).add(buffer.readUInt32BE(i << 2, true));
    }

    return integer.toString();
};

function decodeMapSync(size, offset) {
    var tmp, key,
        map = {},
        i = 0
        ;

    for (i; i < size; i++) {
        tmp = decode(offset);
        key = tmp[0].toString();
        tmp = decode(tmp[1]);
        offset = tmp[1];
        map[key] = tmp[0];
    }

    return [map, offset];
};

function decodeArraySync(size, offset) {
    var tmp,
        i = 0,
        array = []
        ;

    for (i; i < size; i++) {
        tmp = decode(offset);
        offset = tmp[1];
        array.push(tmp[0]);
    }

    return [array, offset];
};

function decodeByType(type, offset, size) {
  var newOffset = offset + size,
      bytes = read(offset, size);

  switch (type) {
    case 'map':
        return decodeMapSync(size, offset);
    case 'array':
        return decodeArraySync(size, offset);
    case 'boolean':
        return [this.decodeBoolean(size), offset];
    case 'utf8_string':
        return [decodeString(bytes), newOffset];
     case 'double':
        return [decodeDouble(bytes), newOffset];
    case 'float':
        return [decodeFloat(bytes), newOffset];
    case 'bytes':
        return [bytes, newOffset];
    case 'uint16':
        return [decodeUint16(bytes), newOffset];
    case 'uint32':
        return [decodeUint32(bytes), newOffset];
    case 'int32':
        return [decodeInt32(bytes), newOffset];
    case 'uint64':
        return [decodeUint64(bytes), newOffset];
    case 'uint128':
        return [decodeUint128(bytes), newOffset];
    default:
        throw new Error("MaxmindDBReader: Unknown or unexpected type: " + type + ' at offset:' + offset);
  }
};

function decodePointer(ctrlByte, offset) {
    var packed, pointer,
        pointerSize = ((ctrlByte >> 3) & 0x3) + 1,
        buffer = read(offset, pointerSize)
        ;

    //To calculate the pointer value, we start by subdiving the five bits into two groups.
    // The first two bits indicate the size, and the next three bits are part of the value,
    // so we end up with a control byte breaking down like this: 001SSVVV.

    offset += pointerSize;

    packed = (pointerSize === 4) ? buffer : Buffer.concat([new Buffer([ctrlByte & 0x7]), buffer], buffer.length + 1);

    pointer = decodeUint32(packed) + pointerBase + pointerValueOffset[pointerSize];

    return [pointer, offset];
};

function sizeFromCtrlByte(ctrlByte, offset) {
    var size = ctrlByte & 0x1f,
        bytesToRead = size < 29 ? 0 : size - 28,
        bytes = read(offset, bytesToRead),
        decoded = decodeUint32(bytes)
        ;

    if (size === 29) {
        size = 29 + decoded;
    } else if (size === 30) {
        size = 285 + decoded;
    } else if (size > 30) {
        size = (decoded & (0x0FFFFFFF >> (32 - (8 * bytesToRead)))) + 65821;
    }

    return [size, offset + bytesToRead];
};

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

// https://github.com/PaddeK/node-maxmind-db/blob/master/lib/Decoder.js
function decode(offset) {
  var tmp,
    ctrlByte = buffer[offset++],
    type = types[ctrlByte >> 5]
    ;

  if (type === 'pointer') {
    tmp = decodePointer(ctrlByte, offset);
    return [decode(tmp[0])[0], tmp[1]];
  }

  if (type === 'extended') {

    tmp = buffer[offset] + 7;

    if (tmp < 8) {
        throw new Error('MaxmindDBReader: Invalid Extended Type at offset:' + offset);
    }

    type = types[tmp];
    offset++;
  }

  tmp = sizeFromCtrlByte(ctrlByte, offset);

  return decodeByType(type, tmp[1], tmp[0]);
}

var metadata = new Metadata(decode(start)[0]);
console.log(metadata);


pointerBase = metadata.getSearchTreeSize() + DATA_SECTION_SEPARATOR_SIZE;

var result = get('2600:1010:b00e:4658:488b:55d4:86a4:3c61');
console.log(result);

function resolveDataPointer(pointer) {
    var resolved = pointer - metadata.getNodeCount() + metadata.getSearchTreeSize();

    return decode(resolved)[0];
};

function get(ipAddress, callback) {
    var pointer = findAddressInTree(ipAddress);
    if (pointer === 0) {
        process.nextTick(function () {
            callback(null, null);
        });
    } else {
        return resolveDataPointer(pointer, callback);
    }
};


function findAddressInTree(ipAddress) {
    var bit, tempBit, record,
        rawAddress = IPParser(ipAddress),
        countRaw = rawAddress.length,
        isIp4AddressInIp6Db = (countRaw === 4 && metadata.getIpVersion() === 6),
        ipStartBit = isIp4AddressInIp6Db ? 96 : 0,
        nodeNum = 0,
        i = 0,
        len = countRaw * 8 + ipStartBit
        ;

    for (i; i < len; i++) {
        bit = 0;

        if (i >= ipStartBit) {
            tempBit = 0xFF & rawAddress[parseInt((i - ipStartBit) / 8, 10)];
            bit = 1 & (tempBit >> 7 - (i % 8));
        }

        record = readNode(nodeNum, bit);

        if (record === metadata.getNodeCount()) {
            return 0;
        }

        if (record > metadata.getNodeCount()) {
            return record;
        }

        nodeNum = record;
    }

    return null;
};

function readNode(nodeNumber, index) {
    var bytes, middle,
        buf = new Buffer(4),
        baseOffset = nodeNumber * metadata.getNodeByteSize()
        ;

    buf.fill(0);

    switch (metadata.getRecordSize()) {
        case 24:
            bytes = baseOffset + index * 3;
            buffer.copy(buf, 1, bytes, bytes + 3);
            return buf.readUInt32BE(0, true);
        case 28:
            middle = buffer.readUInt8(baseOffset + 3, true);
            middle = (index === 0) ? (0xF0 & middle) >> 4 : 0x0F & middle;
            bytes = baseOffset + index * 4;
            buffer.copy(buf, 1, bytes, bytes + 3);
            buf.writeUInt8(middle, 0);
            return buf.readUInt32BE(0, true);
        case 32:
            return buffer.readUInt32BE(baseOffset + index * 4, true);
        default:
            throw new Error("MaxmindDBReader: Unknown Recordsize in DB");
    }
};


