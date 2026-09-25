package app.donely.mobile;

import android.os.Bundle;

import androidx.annotation.NonNull;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must be registered before super.onCreate so the bridge shim exists
        // before the first page load.
        registerPlugin(DonelyNativePlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == DonelyReminders.PERMISSION_REQUEST) {
            DonelyNativePlugin plugin = DonelyNativePlugin.get();
            if (plugin != null) plugin.onNotificationPermissionResult();
        }
    }
}
