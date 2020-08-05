"use strict";

const CR = "\r";
const LF = "\n";
const CRLF = CR + LF;

function callHead(request, path, headers) {
  request = request.head(path);
  if (headers) {
    Object.keys(headers).forEach((vKey) => {
      request.set(vKey, headers[vKey]);
    });
  }
  return request;
}

function callRead(request, path, headers) {
  request = request.get(path);
  if (headers) {
    Object.keys(headers).forEach((vKey) => {
      request.set(vKey, headers[vKey]);
    });
  }
  return request;
}

function callWrite(request, path, payload, update, headers) {
  request = update ? request.merge(path) : request.post(path);
  headers = headers || {};
  Object.keys(headers).forEach((vKey) => {
    request.set(vKey, headers[vKey]);
  });
  request = request.set("content-type", headers["content-type"] || "application/json").send(payload);
  return request;
}

function callDelete(request, path, headers) {
  request = request.delete(path);
  headers = headers || {};
  Object.keys(headers).forEach((vKey) => {
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
  Object.keys(headers).forEach((vKey) => {
    request.set(vKey, headers[vKey]);
  });
  request = request.set("content-type", headers["content-type"] || "application/octet-stream");
  request = request.expect(204);
  return request;
}

function multipartMixedToTextParser(res, callback) {
  let text = "";
  res.setEncoding("utf8");
  res.on("data", (chunk) => {
    text += chunk;
  });
  res.on("end", () => {
    res.text = text;
    callback(null, text);
  });
}

function splitMultipartResponse(body, boundary = "boundary") {
  return body
    .split(new RegExp(`(?:^|\r\n)--${boundary}(?:\r\n|--\r\n$|--$)`))
    .slice(1, -1)
    .map((part) => {
      const [_meta, ..._rest] = part.split("\r\n\r\n");
      const multipart = _meta.match(/content-type:\s*multipart\/mixed;\s*boundary=(\w+)/i);
      if (multipart !== null) {
        const subBoundary = multipart[1];
        return splitMultipartResponse(_rest.join("\r\n\r\n"), subBoundary);
      } else {
        const contentID = _meta.match(/content-id:\s*(\w+)/i);
        const [_info, _body] = _rest;
        const body = _body && _body.startsWith("{") ? JSON.parse(_body) : _body;
        const [_status, ..._headers] = _info.split("\r\n");
        const [protocol, _statusCode, statusText] = _status.split(/\s+/);
        const statusCode = parseInt(_statusCode);
        let headers = {};
        _headers.forEach((_header) => {
          const [key, value] = _header.split(": ");
          headers[key] = value;
        });
        return { statusCode, statusText, headers, body, contentID: contentID && contentID[1] };
      }
    });
}

module.exports = {
  callHead,
  callRead,
  callWrite,
  callDelete,
  callMultipart,
  splitMultipartResponse,
  callStream,
};
