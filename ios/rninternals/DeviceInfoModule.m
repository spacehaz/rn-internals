//
//  DeviceInfoModule.m
//  
//
//  Created by Hazo Baykulov on 07.07.2026.
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_REMAP_MODULE(CustomDeviceInfo, DeviceInfoModule, NSObject)

RCT_EXTERN_METHOD(getModel)
RCT_EXTERN_METHOD(getSystemVersion)
RCT_EXTERN_METHOD(getBatteryLevel:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getNativeStartTime)

@end
