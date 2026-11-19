package dev.bierdeckel.app;

import android.bluetooth.*;
import android.bluetooth.le.*;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import android.util.Log;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Phone-to-phone link over Bluetooth Low Energy, no pairing needed.
 * Every phone advertises the Bierdeckel service with its own ID and scans for friends.
 * Of two friends, the phone with the smaller ID connects (central); the other serves (peripheral).
 * Messages are UTF-8 strings, split into chunks: first byte 1 = last chunk, 0 = more follows.
 * The central's first message is "ID:<its id>" so the peripheral knows who connected.
 */
@SuppressWarnings("MissingPermission")
class BleLink {
    interface Events { void open(String id); void data(String id, String msg); void close(String id); void log(String s); }

    static final UUID SVC = UUID.fromString("6b1f0a52-3c9d-4e7a-9b8e-b1e7d3c2a001");
    static final UUID RX = UUID.fromString("6b1f0a52-3c9d-4e7a-9b8e-b1e7d3c2a002"); // central writes here
    static final UUID TX = UUID.fromString("6b1f0a52-3c9d-4e7a-9b8e-b1e7d3c2a003"); // peripheral notifies here
    static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
    static final String TAG = "BierdeckelBLE";

    final Context ctx; final Events ev; final Handler main = new Handler(Looper.getMainLooper());
    BluetoothManager bm; BluetoothAdapter ad; BluetoothGattServer server; BluetoothGattCharacteristic txChar;
    String myId; final Set<String> contacts = new HashSet<>();
    boolean running;

    /** One link per friend, either as central (gatt != null) or as peripheral (device != null). */
    class Link {
        String id; BluetoothGatt gatt; BluetoothDevice device; int mtu = 23; boolean open;
        final ArrayDeque<byte[]> out = new ArrayDeque<>(); boolean busy;
        final ByteArrayOutputStream in = new ByteArrayOutputStream();
    }
    final Map<String, Link> byId = new HashMap<>();          // friend id -> link
    final Map<String, Link> byAddr = new HashMap<>();        // device address -> link
    final Set<String> connecting = new HashSet<>();

    BleLink(Context c, Events e) { ctx = c; ev = e; }

    boolean start(String id, Collection<String> friends) {
        myId = id; setContacts(friends);
        if (running) return true;
        bm = (BluetoothManager) ctx.getSystemService(Context.BLUETOOTH_SERVICE);
        ad = bm == null ? null : bm.getAdapter();
        if (ad == null || !ad.isEnabled()) { ev.log("bluetooth off"); return false; }
        try {
            openServer(); advertise(); scan();
            running = true; ev.log("started");
            return true;
        } catch (Exception e) { ev.log("start failed: " + e); stop(); return false; }
    }

    void setContacts(Collection<String> friends) { contacts.clear(); contacts.addAll(friends); }

    void stop() {
        running = false;
        try { BluetoothLeScanner s = ad.getBluetoothLeScanner(); if (s != null) s.stopScan(scanCb); } catch (Exception e) { }
        try { BluetoothLeAdvertiser a = ad.getBluetoothLeAdvertiser(); if (a != null) a.stopAdvertising(advCb); } catch (Exception e) { }
        for (Link l : new ArrayList<>(byAddr.values())) drop(l);
        try { if (server != null) server.close(); } catch (Exception e) { }
        server = null;
    }

    // ---------- advertising + scanning ----------
    static byte[] hex(String s) {
        byte[] b = new byte[s.length() / 2];
        for (int i = 0; i < b.length; i++) b[i] = (byte) Integer.parseInt(s.substring(2 * i, 2 * i + 2), 16);
        return b;
    }
    static String unhex(byte[] b) { StringBuilder sb = new StringBuilder(); for (byte x : b) sb.append(String.format("%02x", x)); return sb.toString(); }

    final AdvertiseCallback advCb = new AdvertiseCallback() {
        @Override public void onStartFailure(int code) { ev.log("advertise failed " + code); }
        @Override public void onStartSuccess(AdvertiseSettings s) { ev.log("advertising"); }
    };
    void advertise() {
        BluetoothLeAdvertiser a = ad.getBluetoothLeAdvertiser();
        if (a == null) { ev.log("no advertiser"); return; }
        AdvertiseSettings set = new AdvertiseSettings.Builder().setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM).setConnectable(true).build();
        AdvertiseData data = new AdvertiseData.Builder().addServiceUuid(new ParcelUuid(SVC)).setIncludeDeviceName(false).build();
        AdvertiseData resp = new AdvertiseData.Builder().addServiceData(new ParcelUuid(SVC), hex(myId)).setIncludeDeviceName(false).build();
        a.startAdvertising(set, data, resp, advCb);
    }

    final ScanCallback scanCb = new ScanCallback() {
        @Override public void onScanResult(int type, ScanResult r) { main.post(() -> found(r)); }
        @Override public void onBatchScanResults(List<ScanResult> rs) { for (ScanResult r : rs) main.post(() -> found(r)); }
        @Override public void onScanFailed(int code) { ev.log("scan failed " + code); }
    };
    void scan() {
        BluetoothLeScanner s = ad.getBluetoothLeScanner();
        if (s == null) { ev.log("no scanner"); return; }
        ScanFilter f = new ScanFilter.Builder().setServiceUuid(new ParcelUuid(SVC)).build();
        ScanSettings set = new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build();
        s.startScan(Collections.singletonList(f), set, scanCb);
    }
    void found(ScanResult r) {
        if (!running || r.getScanRecord() == null) return;
        byte[] sd = r.getScanRecord().getServiceData(new ParcelUuid(SVC));
        if (sd == null || sd.length != 10) return;
        String id = unhex(sd);
        if (!contacts.contains(id) || id.equals(myId)) return;
        if (myId.compareTo(id) > 0) return;                 // the other phone connects to us
        if (byId.containsKey(id) || connecting.contains(id)) return;
        connecting.add(id);
        ev.log("connecting to " + id);
        Link l = new Link(); l.id = id; l.device = r.getDevice();
        byAddr.put(l.device.getAddress(), l);
        l.gatt = l.device.connectGatt(ctx, false, gattCb, BluetoothDevice.TRANSPORT_LE);
        main.postDelayed(() -> { if (connecting.remove(id) && !l.open) drop(l); }, 20000);
    }

    // ---------- central side ----------
    final BluetoothGattCallback gattCb = new BluetoothGattCallback() {
        @Override public void onConnectionStateChange(BluetoothGatt g, int status, int state) {
            main.post(() -> {
                Link l = byAddr.get(g.getDevice().getAddress());
                if (l == null) { g.close(); return; }
                if (state == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) g.discoverServices();
                else drop(l);
            });
        }
        @Override public void onServicesDiscovered(BluetoothGatt g, int status) { main.post(() -> g.requestMtu(517)); }
        @Override public void onMtuChanged(BluetoothGatt g, int mtu, int status) {
            main.post(() -> {
                Link l = byAddr.get(g.getDevice().getAddress());
                if (l == null) return;
                if (status == BluetoothGatt.GATT_SUCCESS) l.mtu = mtu;
                BluetoothGattService s = g.getService(SVC);
                if (s == null) { drop(l); return; }
                BluetoothGattCharacteristic tx = s.getCharacteristic(TX);
                g.setCharacteristicNotification(tx, true);
                BluetoothGattDescriptor d = tx.getDescriptor(CCCD);
                d.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                g.writeDescriptor(d);
            });
        }
        @Override public void onDescriptorWrite(BluetoothGatt g, BluetoothGattDescriptor d, int status) {
            main.post(() -> {
                Link l = byAddr.get(g.getDevice().getAddress());
                if (l == null) return;
                if (status != BluetoothGatt.GATT_SUCCESS) { drop(l); return; }
                connecting.remove(l.id);
                opened(l);
                enqueue(l, "ID:" + myId);
            });
        }
        @Override public void onCharacteristicWrite(BluetoothGatt g, BluetoothGattCharacteristic c, int status) {
            main.post(() -> { Link l = byAddr.get(g.getDevice().getAddress()); if (l != null) { l.busy = false; pump(l); } });
        }
        @Override public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic c) {
            byte[] v = c.getValue().clone();
            main.post(() -> { Link l = byAddr.get(g.getDevice().getAddress()); if (l != null) chunkIn(l, v); });
        }
    };

    // ---------- peripheral side ----------
    void openServer() {
        server = bm.openGattServer(ctx, serverCb);
        BluetoothGattService s = new BluetoothGattService(SVC, BluetoothGattService.SERVICE_TYPE_PRIMARY);
        BluetoothGattCharacteristic rx = new BluetoothGattCharacteristic(RX,
            BluetoothGattCharacteristic.PROPERTY_WRITE, BluetoothGattCharacteristic.PERMISSION_WRITE);
        txChar = new BluetoothGattCharacteristic(TX, BluetoothGattCharacteristic.PROPERTY_NOTIFY, BluetoothGattCharacteristic.PERMISSION_READ);
        txChar.addDescriptor(new BluetoothGattDescriptor(CCCD, BluetoothGattDescriptor.PERMISSION_READ | BluetoothGattDescriptor.PERMISSION_WRITE));
        s.addCharacteristic(rx); s.addCharacteristic(txChar);
        server.addService(s);
    }
    final BluetoothGattServerCallback serverCb = new BluetoothGattServerCallback() {
        @Override public void onConnectionStateChange(BluetoothDevice d, int status, int state) {
            main.post(() -> {
                if (state == BluetoothProfile.STATE_CONNECTED) {
                    if (!byAddr.containsKey(d.getAddress())) { Link l = new Link(); l.device = d; byAddr.put(d.getAddress(), l); }
                } else { Link l = byAddr.get(d.getAddress()); if (l != null && l.gatt == null) drop(l); }
            });
        }
        @Override public void onMtuChanged(BluetoothDevice d, int mtu) {
            main.post(() -> { Link l = byAddr.get(d.getAddress()); if (l != null) l.mtu = mtu; });
        }
        @Override public void onDescriptorWriteRequest(BluetoothDevice d, int req, BluetoothGattDescriptor desc, boolean prep, boolean resp, int off, byte[] v) {
            if (resp) server.sendResponse(d, req, BluetoothGatt.GATT_SUCCESS, 0, null);
        }
        @Override public void onCharacteristicWriteRequest(BluetoothDevice d, int req, BluetoothGattCharacteristic c, boolean prep, boolean resp, int off, byte[] v) {
            if (resp) server.sendResponse(d, req, BluetoothGatt.GATT_SUCCESS, 0, null);
            byte[] copy = v.clone();
            main.post(() -> { Link l = byAddr.get(d.getAddress()); if (l != null) chunkIn(l, copy); });
        }
        @Override public void onNotificationSent(BluetoothDevice d, int status) {
            main.post(() -> { Link l = byAddr.get(d.getAddress()); if (l != null) { l.busy = false; pump(l); } });
        }
    };

    // ---------- framing ----------
    void chunkIn(Link l, byte[] v) {
        if (v.length == 0) return;
        l.in.write(v, 1, v.length - 1);
        if (v[0] != 1) return;
        String msg = new String(l.in.toByteArray(), StandardCharsets.UTF_8);
        l.in.reset();
        if (l.id == null) {                                  // peripheral: first message names the central
            if (!msg.startsWith("ID:")) return;
            String id = msg.substring(3);
            if (!contacts.contains(id)) { ev.log("unknown central " + id); drop(l); return; }
            l.id = id; opened(l); return;
        }
        ev.data(l.id, msg);
    }
    void opened(Link l) {
        Link old = byId.get(l.id);
        if (old != null && old != l) drop(old);
        byId.put(l.id, l); l.open = true;
        ev.log("open " + l.id);
        ev.open(l.id);
    }
    boolean send(String id, String msg) {
        Link l = byId.get(id);
        if (l == null || !l.open) return false;
        enqueue(l, msg); return true;
    }
    void enqueue(Link l, String msg) {
        byte[] b = msg.getBytes(StandardCharsets.UTF_8);
        int size = Math.max(20, Math.min(l.mtu, 512) - 3) - 1;
        for (int i = 0; i < b.length || i == 0; i += size) {
            int n = Math.min(size, b.length - i);
            byte[] c = new byte[n + 1];
            c[0] = (byte) (i + n >= b.length ? 1 : 0);
            System.arraycopy(b, i, c, 1, n);
            l.out.add(c);
            if (b.length == 0) break;
        }
        pump(l);
    }
    void pump(Link l) {
        if (l.busy || l.out.isEmpty()) return;
        byte[] c = l.out.poll();
        l.busy = true;
        boolean ok;
        if (l.gatt != null) {
            BluetoothGattService s = l.gatt.getService(SVC);
            BluetoothGattCharacteristic rx = s == null ? null : s.getCharacteristic(RX);
            if (rx == null) { drop(l); return; }
            rx.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
            rx.setValue(c);
            ok = l.gatt.writeCharacteristic(rx);
        } else {
            txChar.setValue(c);
            ok = server != null && server.notifyCharacteristicChanged(l.device, txChar, false);
        }
        if (!ok) { l.busy = false; l.out.addFirst(c); main.postDelayed(() -> pump(l), 50); }
    }
    void close(String id) { Link l = byId.get(id); if (l != null) drop(l); }
    void drop(Link l) {
        if (l.device != null) byAddr.remove(l.device.getAddress());
        if (l.id != null) { connecting.remove(l.id); if (byId.get(l.id) == l) { byId.remove(l.id); if (l.open) ev.close(l.id); } }
        l.open = false;
        try { if (l.gatt != null) { l.gatt.disconnect(); l.gatt.close(); } } catch (Exception e) { }
        try { if (l.gatt == null && l.device != null && server != null) server.cancelConnection(l.device); } catch (Exception e) { }
    }
}
