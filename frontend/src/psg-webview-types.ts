export type PsgWebViewHandle = {
  goBack: () => void;
  injectJavaScript: (js: string) => void;
};

export type PsgWebViewProps = {
  uri: string;
  injectedBefore: string;
  injectedMain: string;
  onMessage: (data: string) => void;
  onNavStateChange: (canGoBack: boolean) => void;
  onLoadEnd: () => void;
  onExternalUrl: (url: string) => void;
  backgroundColor: string;
};
