/*
 * Copyright (c) 2023 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import UIAbility from '@ohos.app.ability.UIAbility';
import Window from '@ohos.window';
import { hilog } from '@kit.PerformanceAnalysisKit';
import Notification from '@ohos.notificationManager';
import { abilityAccessCtrl, common, PermissionRequestResult, Permissions } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { calendarManager } from '@kit.CalendarKit';

export let calendarMgr: calendarManager.CalendarManager | null = null;
export let mContext: common.UIAbilityContext | null = null;

export default class EntryAbility extends UIAbility {
  onWindowStageCreate(windowStage: Window.WindowStage) {
    windowStage.loadContent('pages/Index', (err, data) => {
      if (err.code) {
        hilog.error(0x0000, 'CountDown', `Failed to load the content. Cause: ${JSON.stringify(err)}`);
        return;
      }
      hilog.info(0x0000, 'CountDown', `loadContent success`);
    });
  }
}
