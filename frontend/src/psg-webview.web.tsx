import { createElement, forwardRef, useImperativeHandle, useRef } from "react";

import type { PsgWebViewHandle, PsgWebViewProps } from "./psg-webview-types";

// Web preview only: react-native-webview does not support the web platform, so
// we render the real PWA in a same-origin <iframe> and wire the bridge into it.
// (Native builds use psg-webview.native.tsx.)
export const PsgWebView = forwardRef<PsgWebViewHandle, PsgWebViewProps>((props, ref) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useImperativeHandle(ref, () => ({
    goBack: () => {
      try {
        iframeRef.current?.contentWindow?.history.back();
      } catch {}
    },
    injectJavaScript: (js: string) => {
      try {
        (iframeRef.current?.contentWindow as any)?.eval(js);
      } catch {}
    },
  }));

  const onLoad = () => {
    try {
      const w = iframeRef.current?.contentWindow as any;
      if (w) {
        w.ReactNativeWebView = { postMessage: (d: string) => props.onMessage(d) };
        try {
          w.eval(props.injectedMain);
        } catch {}
      }
    } catch {}
    props.onLoadEnd();
  };

  return createElement("iframe", {
    ref: iframeRef,
    src: props.uri,
    onLoad,
    style: {
      border: "none",
      width: "100%",
      height: "100%",
      flex: 1,
      background: props.backgroundColor,
    },
    "data-testid": "psg-webview",
  });
});
PsgWebView.displayName = "PsgWebView";
