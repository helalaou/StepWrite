package io.github.helalaou.stepwrite;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Lets the web client color the window behind the status and navigation bars
 * to match its light or dark theme. SystemBars insets the web view, so the
 * window background shows in those strips.
 */
@CapacitorPlugin(name = "Appearance")
public class AppearancePlugin extends Plugin {

    @PluginMethod
    public void setBackgroundColor(PluginCall call) {
        int color;
        try {
            color = Color.parseColor(call.getString("color", ""));
        } catch (IllegalArgumentException e) {
            call.reject("color must be a #rrggbb color");
            return;
        }
        getActivity().runOnUiThread(() -> {
            getActivity().getWindow().setBackgroundDrawable(new ColorDrawable(color));
            call.resolve();
        });
    }
}
