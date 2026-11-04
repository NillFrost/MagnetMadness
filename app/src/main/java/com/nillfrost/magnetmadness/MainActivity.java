package com.nillfrost.magnetmadness;

import android.app.Activity;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

/** Fullscreen offline shell for the embedded Magnet Madness HTML5 build. */
public final class MainActivity extends Activity {
    private WebView gameView;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(6, 11, 25));
        getWindow().setNavigationBarColor(Color.rgb(6, 11, 25));
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemBars();

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

        gameView = new WebView(this);
        gameView.setBackgroundColor(Color.rgb(6, 11, 25));
        gameView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        gameView.setHorizontalScrollBarEnabled(false);
        gameView.setVerticalScrollBarEnabled(false);

        final WebSettings options = gameView.getSettings();
        options.setJavaScriptEnabled(true);
        options.setDomStorageEnabled(true);
        options.setAllowFileAccess(false);
        options.setAllowContentAccess(false);
        options.setJavaScriptCanOpenWindowsAutomatically(false);
        options.setSupportMultipleWindows(false);
        options.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        options.setMediaPlaybackRequiresUserGesture(true);

        gameView.setWebChromeClient(new WebChromeClient());
        gameView.setWebViewClient(new WebViewClientCompat() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }
        });
        setContentView(gameView);
        gameView.loadUrl("https://appassets.androidplatform.net/assets/index.html");
    }

    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override public void onConfigurationChanged(Configuration config) {
        super.onConfigurationChanged(config);
        hideSystemBars();
    }

    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() {
        if (gameView != null) {
            // Mirrors the game's Escape shortcut: pause / resume countdown / close panel.
            gameView.evaluateJavascript(
                "window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}))", null);
        } else {
            super.onBackPressed();
        }
    }

    @Override protected void onDestroy() {
        if (gameView != null) {
            gameView.destroy();
            gameView = null;
        }
        super.onDestroy();
    }
}
