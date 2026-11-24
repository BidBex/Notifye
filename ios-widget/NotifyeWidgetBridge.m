#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(NotifyeWidgetBridge, "NotifyeWidgetBridge",
           CAP_PLUGIN_METHOD(syncWidgetState, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(clearWidgetState, CAPPluginReturnPromise);
)
