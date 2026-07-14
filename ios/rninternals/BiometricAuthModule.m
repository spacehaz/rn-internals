//
//  BiometricAuthModule.m
//  
//
//  Created by Hazo Baykulov on 07.07.2026.
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_REMAP_MODULE(BiometricAuth, BiometricAuthModule, NSObject)

RCT_EXTERN_METHOD(getBiometryType)
RCT_EXTERN_METHOD(authenticate:(NSString *)reason
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end