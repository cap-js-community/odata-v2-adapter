"use strict";

const CR = "\r";
const LF = "\n";
const CRLF = CR + LF;

function callHead(request, path, headers) {
  request = request.head(path);
  if (headers) {
    Object.keys(headers).forEach(vKey => {
      request.set(vKey, headers[vKey]);
    });
  }
  return request;
}

function callRead(request, path, headers) {
  request = request.get(path);
  if (headers) {
    Object.keys(headers).forEach(vKey => {
      request.set(vKey, headers[vKey]);
    });
  }
  return request;
}

function callWrite(request, path, payload, update, headers) {
  request = update ? request.patch(path) : request.post(path);
  headers = headers || {};
  Object.keys(headers).forEach(vKey => {
    request.set(vKey, headers[vKey]);
  });
  request = request.set("content-type", headers["content-type"] || "application/json").send(payload);
  return request;
}

function callDelete(request, path, headers) {
  request = request.delete(path);
  headers = headers || {};
  Object.keys(headers).forEach(vKey => {
    request.set(vKey, headers[vKey]);
  });
  return request;
}

function callMultipart(request, path, payload) {
  payload = payload.split(LF).join(CRLF);
  return request
    .post(path)
    .accept("multipart/mixed,application/json")
    .type("multipart/mixed;boundary=boundary")
    .parse(multipartMixedToTextParser)
    .send(payload);
}

function callStream(request, path, headers) {
  request = request.put(path);
  headers = headers || {};
  Object.keys(headers).forEach(vKey => {
    request.set(vKey, headers[vKey]);
  });
  request = request.set("content-type", headers["content-type"] || "application/octet-stream");
  request = request.expect(204);
  return request;
}

function multipartMixedToTextParser(res, callback) {
  let text = "";
  res.setEncoding("utf8");
  res.on("data", chunk => {
    text += chunk;
  });
  res.on("end", () => {
    res.text = text;
    callback(null, text);
  });
}

module.exports = {
  callHead,
  callRead,
  callWrite,
  callDelete,
  callMultipart,
  callStream
};
