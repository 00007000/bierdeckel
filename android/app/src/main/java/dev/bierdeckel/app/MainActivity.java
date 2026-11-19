package dev.bierdeckel.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.*;
import android.widget.Toast;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import android.bluetooth.BluetoothAdapter;
import android.os.Build;
import android.util.Log;

public class MainActivity extends Activity {
    static final String HOME = "https://00007000.github.io/bierdeckel/";
    WebView web;
    PermissionRequest pendingPerm;
    ValueCallback<Uri[]> fileCb;
    BleLink ble;
    String bleMe; List<String> bleFriends = new ArrayList<>();
    boolean bleWanted, bleAsked;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        WebView.setWebContentsDebuggingEnabled(true);
        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUserAgentString(s.getUserAgentString() + " BierdeckelApp/1");
        web.addJavascriptInterface(new Bridge(), "BierdeckelAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (u.toString().startsWith(HOME)) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest req) {
                if (checkSelfPermission(android.Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    req.grant(req.getResources());
                } else {
                    pendingPerm = req;
                    requestPermissions(new String[]{android.Manifest.permission.CAMERA}, 1);
                }
            }
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                try { startActivityForResult(i, 2); } catch (Exception e) { fileCb = null; return false; }
                return true;
            }
        });
        // backups are blob: downloads; read them in JS and hand the bytes to Java
        web.setDownloadListener((url, ua, cd, mime, len) -> {
            String name = URLUtil.guessFileName(url, cd, mime);
            String js = "(async()=>{const a=[...document.querySelectorAll('a[download]')].pop();" +
                "const n=a?a.download:" + JSONQuote(name) + ";const r=await fetch(" + JSONQuote(url) + ");const b=await r.blob();" +
                "const f=new FileReader();f.onload=()=>BierdeckelAndroid.save(n,f.result.split(',')[1]);f.readAsDataURL(b);})()";
            web.evaluateJavascript(js, null);
        });
        ble = new BleLink(this, new BleLink.Events() {
            public void open(String id) { js("open", id, null); }
            public void data(String id, String m) { js("data", id, m); }
            public void close(String id) { js("close", id, null); }
            public void log(String m) { Log.i(BleLink.TAG, m); js("log", "", m); }
        });
        if (b != null) web.restoreState(b); else web.loadUrl(target(getIntent()));
    }

    void js(String type, String id, String data) {
        String call = "window.bleEvent&&window.bleEvent(" + JSONObjectQuote(type) + "," + JSONObjectQuote(id) + "," + (data == null ? "null" : JSONObjectQuote(data)) + ")";
        runOnUiThread(() -> web.evaluateJavascript(call, null));
    }
    static String JSONObjectQuote(String s) { return org.json.JSONObject.quote(s); }

    String[] blePerms() {
        return Build.VERSION.SDK_INT >= 31
            ? new String[]{"android.permission.BLUETOOTH_SCAN", "android.permission.BLUETOOTH_CONNECT", "android.permission.BLUETOOTH_ADVERTISE"}
            : new String[]{android.Manifest.permission.ACCESS_FINE_LOCATION};
    }
    boolean hasBlePerms() {
        for (String p : blePerms()) if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) return false;
        return true;
    }
    void bleTry() {
        if (!bleWanted || bleMe == null) return;
        if (!hasBlePerms()) { if (!bleAsked) { bleAsked = true; requestPermissions(blePerms(), 3); } return; }
        BluetoothAdapter ad = BluetoothAdapter.getDefaultAdapter();
        if (ad != null && !ad.isEnabled()) {
            if (!bleAsked) { bleAsked = true; try { startActivityForResult(new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), 4); } catch (Exception e) { } }
            js("log", "", "bluetooth off");
            return;
        }
        ble.start(bleMe, bleFriends);
    }

    @Override protected void onStop() { super.onStop(); if (ble != null) ble.stop(); }
    @Override protected void onStart() { super.onStart(); bleTry(); }

    static String JSONQuote(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }

    String target(Intent i) {
        Uri d = i == null ? null : i.getData();
        if (d != null && "bierdeckel".equals(d.getScheme())) {
            String h = d.getQueryParameter("h");
            return h == null || h.isEmpty() ? HOME : HOME + "#" + h;
        }
        return d != null && d.toString().startsWith(HOME) ? d.toString() : HOME;
    }

    @Override protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        if (i.getData() != null) web.loadUrl(target(i));
    }

    // The invite page copies the invite link before downloading the APK, so a fresh install connects by itself.
    @Override public void onWindowFocusChanged(boolean has) {
        super.onWindowFocusChanged(has);
        if (!has) return;
        try {
            ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            ClipData c = cm.getPrimaryClip();
            if (c == null || c.getItemCount() == 0 || c.getItemAt(0).getText() == null) return;
            String t = c.getItemAt(0).getText().toString().trim();
            int i = t.indexOf("#pair=");
            if (!t.startsWith(HOME) || i < 0) return;
            cm.clearPrimaryClip();
            web.loadUrl(HOME + t.substring(i));
        } catch (Exception e) { }
    }

    @Override protected void onSaveInstanceState(Bundle o) { super.onSaveInstanceState(o); web.saveState(o); }

    @Override public void onRequestPermissionsResult(int code, String[] p, int[] r) {
        if (code == 3) { bleTry(); return; }
        if (pendingPerm == null) return;
        if (r.length > 0 && r[0] == PackageManager.PERMISSION_GRANTED) pendingPerm.grant(pendingPerm.getResources());
        else pendingPerm.deny();
        pendingPerm = null;
    }

    @Override protected void onActivityResult(int code, int res, Intent data) {
        if (code == 4) { bleTry(); return; }
        if (code == 2 && fileCb != null) {
            fileCb.onReceiveValue(res == RESULT_OK && data != null && data.getData() != null ? new Uri[]{data.getData()} : null);
            fileCb = null;
        }
    }

    @Override public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    class Bridge {
        @JavascriptInterface public void bleStart(String me, String friendsJson) {
            runOnUiThread(() -> {
                try { JSONArray a = new JSONArray(friendsJson); bleFriends.clear(); for (int i = 0; i < a.length(); i++) bleFriends.add(a.getString(i)); } catch (Exception e) { }
                bleMe = me; bleWanted = true;
                ble.setContacts(bleFriends);
                bleTry();
            });
        }
        @JavascriptInterface public boolean bleSend(String id, String msg) {
            final boolean[] ok = {false};
            runOnUiThread(() -> ble.send(id, msg));
            return true;
        }
        @JavascriptInterface public void bleClose(String id) { runOnUiThread(() -> ble.close(id)); }
        @JavascriptInterface public void save(String name, String b64) {
            try {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                v.put(MediaStore.Downloads.MIME_TYPE, "application/json");
                v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                try (OutputStream o = getContentResolver().openOutputStream(u)) { o.write(Base64.decode(b64, Base64.DEFAULT)); }
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Saved to Downloads: " + name, Toast.LENGTH_LONG).show());
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Could not save backup: " + e.getMessage(), Toast.LENGTH_LONG).show());
            }
        }
    }
}
