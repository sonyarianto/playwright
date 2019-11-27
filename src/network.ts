// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as types from './types';
import * as frames from './frames';

export type NetworkCookie = {
  name: string,
  value: string,
  domain: string,
  path: string,
  expires: number,
  size: number,
  httpOnly: boolean,
  secure: boolean,
  session: boolean,
  sameSite: 'Strict' | 'Lax' | 'None'
};

export type SetNetworkCookieParam = {
  name: string,
  value: string,
  url?: string,
  domain?: string,
  path?: string,
  expires?: number,
  httpOnly?: boolean,
  secure?: boolean,
  sameSite?: 'Strict' | 'Lax' | 'None'
};

export function filterCookies(cookies: NetworkCookie[], urls: string[]) {
  const parsedURLs = urls.map(s => new URL(s));
  // Chromiums's cookies are missing sameSite when it is 'None'
  return cookies.filter(c => {
    if (!parsedURLs.length)
      return true;
    for (const parsedURL of parsedURLs) {
      if (parsedURL.hostname !== c.domain)
        continue;
      if (!parsedURL.pathname.startsWith(c.path))
        continue;
      if ((parsedURL.protocol === 'https:') !== c.secure)
        continue;
      return true;
    }
    return false;
  });
}

export type Headers = { [key: string]: string };

export class Request<ElementHandle extends types.ElementHandle<ElementHandle>> {
  _response: Response<ElementHandle> | null = null;
  _redirectChain: Request<ElementHandle>[];
  private _isNavigationRequest: boolean;
  private _failureText: string | null = null;
  private _url: string;
  private _resourceType: string;
  private _method: string;
  private _postData: string;
  private _headers: Headers;
  private _frame: frames.Frame<ElementHandle>;

  constructor(frame: frames.Frame<ElementHandle> | null, redirectChain: Request<ElementHandle>[], isNavigationRequest: boolean,
    url: string, resourceType: string, method: string, postData: string, headers: Headers) {
    this._frame = frame;
    this._redirectChain = redirectChain;
    this._isNavigationRequest = isNavigationRequest;
    this._url = url;
    this._resourceType = resourceType;
    this._method = method;
    this._postData = postData;
    this._headers = headers;
  }

  _setFailureText(failureText: string) {
    this._failureText = failureText;
  }

  url(): string {
    return this._url;
  }

  resourceType(): string {
    return this._resourceType;
  }

  method(): string {
    return this._method;
  }

  postData(): string | undefined {
    return this._postData;
  }

  headers(): {[key: string]: string} {
    return this._headers;
  }

  response(): Response<ElementHandle> | null {
    return this._response;
  }

  frame(): frames.Frame<ElementHandle> | null {
    return this._frame;
  }

  isNavigationRequest(): boolean {
    return this._isNavigationRequest;
  }

  redirectChain(): Request<ElementHandle>[] {
    return this._redirectChain.slice();
  }

  failure(): { errorText: string; } | null {
    if (!this._failureText)
      return null;
    return {
      errorText: this._failureText
    };
  }
}

export type RemoteAddress = {
  ip: string,
  port: number,
};

type GetResponseBodyCallback = () => Promise<Buffer>;

export class Response<ElementHandle extends types.ElementHandle<ElementHandle>> {
  private _request: Request<ElementHandle>;
  private _contentPromise: Promise<Buffer> | null = null;
  private _bodyLoadedPromise: Promise<Error | null>;
  private _bodyLoadedPromiseFulfill: any;
  private _remoteAddress: RemoteAddress;
  private _status: number;
  private _statusText: string;
  private _url: string;
  private _headers: Headers;
  private _getResponseBodyCallback: GetResponseBodyCallback;

  constructor(request: Request<ElementHandle>, status: number, statusText: string, headers: Headers, remoteAddress: RemoteAddress, getResponseBodyCallback: GetResponseBodyCallback) {
    this._request = request;
    this._request._response = this;
    this._status = status;
    this._statusText = statusText;
    this._url = request.url();
    this._headers = headers;
    this._remoteAddress = remoteAddress;
    this._getResponseBodyCallback = getResponseBodyCallback;
    this._bodyLoadedPromise = new Promise(fulfill => {
      this._bodyLoadedPromiseFulfill = fulfill;
    });
  }

  _bodyLoaded(error?: Error) {
    this._bodyLoadedPromiseFulfill.call(null, error);
  }

  remoteAddress(): RemoteAddress {
    return this._remoteAddress;
  }

  url(): string {
    return this._url;
  }

  ok(): boolean {
    return this._status === 0 || (this._status >= 200 && this._status <= 299);
  }

  status(): number {
    return this._status;
  }

  statusText(): string {
    return this._statusText;
  }

  headers(): object {
    return this._headers;
  }

  buffer(): Promise<Buffer> {
    if (!this._contentPromise) {
      this._contentPromise = this._bodyLoadedPromise.then(async error => {
        if (error)
          throw error;
        return this._getResponseBodyCallback();
      });
    }
    return this._contentPromise;
  }

  async text(): Promise<string> {
    const content = await this.buffer();
    return content.toString('utf8');
  }

  async json(): Promise<object> {
    const content = await this.text();
    return JSON.parse(content);
  }

  request(): Request<ElementHandle> {
    return this._request;
  }

  frame(): frames.Frame<ElementHandle> | null {
    return this._request.frame();
  }
}