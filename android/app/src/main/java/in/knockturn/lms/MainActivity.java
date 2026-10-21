package in.knockturn.lms;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LmsBackgroundSyncPlugin.class);
        super.onCreate(savedInstanceState);
        
        // Keep status bar (timing/clock) and navigation bar fully outside the webview
        // so header and bottom actions never overlap system chrome
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

        // Ensure notification channels exist on app launch
        LmsNotificationHelper.ensureChannels(this);
    }
}

