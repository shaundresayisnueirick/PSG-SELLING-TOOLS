import { forwardRef, useImperativeHandle, useRef } from "react";
import { WebView } from "react-native-webview";

import type { PsgWebViewHandle, PsgWebViewProps } from "./psg-webview-types";

// Native: the real offline WebView loading file:// assets.
export const PsgWebView = forwardRef<PsgWebViewHandle, PsgWebViewProps>((props, ref) => {
  const web = useRef<WebView>(null);
  useImperativeHandle(ref, () => ({
    goBack: () => web.current?.goBack(),
    injectJavaScript: (js: string) => web.current?.injectJavaScript(js),
  }));

  return (
    <WebView
      ref={web}
      testID="psg-webview"
      source={{ uri: props.uri }}
      style={{ flex: 1, backgroundColor: props.backgroundColor }}
      originWhitelist={["*"]}
      allowFileAccess
      allowFileAccessFromFileURLs
      allowUniversalAccessFromFileURLs
      domStorageEnabled
      javaScriptEnabled
      setSupportMultipleWindows={false}
      overScrollMode="never"
      injectedJavaScriptBeforeContentLoaded={props.injectedBefore}
      injectedJavaScript={props.injectedMain}
      onMessage={(e) => props.onMessage(e.nativeEvent.data)}
      onNavigationStateChange={(s) => props.onNavStateChange(s.canGoBack)}
      onLoadEnd={props.onLoadEnd}
      onShouldStartLoadWithRequest={(req) => {
        const url = req.url || "";
        if (url.startsWith("file://") || url.startsWith("about:") || url.startsWith("data:")) return true;
        if (/^https?:\/\//i.test(url)) {
          props.onExternalUrl(url);
          return false;
        }
        return true;
      }}
    />
  );
});
PsgWebView.displayName = "PsgWebView";
