/*
 * Copyright (c) 2022-2023 Huawei Device Co., Ltd.
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



@Component
export struct CountDown {
  @State timer: number = 0;
  @State rotates: number = 0;
  @State hoursTime: number = 0;
  @State minuteTime: number = 0;
  @State secondTime: number = 0;
  @State progressVal: number = 0;

  @State isRunning: boolean = false;
  @State isPausing: boolean = false;
  @State startImg: Resource = $r('app.media.start');
  @State resetImg: Resource = $r('app.media.resetccc');
  private passSec: number = 0;
  private countInSec: number = 0;

  timerCountDown() {
    this.secondTime--;
    if (this.secondTime < 0) {
      this.minuteTime--;
      this.secondTime = 59;
    }
    if (this.minuteTime < 0) {
      this.minuteTime = 59;
      this.hoursTime--;
    }
    if (this.hoursTime < 0) {
      this.reset();
      return;
    }
    this.passSec++
    this.progressVal = 100 - this.passSec * 100 / this.countInSec;
    this.rotates = this.passSec * 360 / this.countInSec;
  }

  start() {
    this.countInSec = this.hoursTime * 3600 + this.minuteTime * 60 + this.secondTime;
    this.isRunning = true;
    this.isPausing = false;
    this.startImg = $r('app.media.pause');
    this.resetImg = $r('app.media.reset');
    this.timer = setInterval(this.timerCountDown.bind(this), 1000);
  }

  pause() {
    clearInterval(this.timer);
    this.isRunning = true;
    this.isPausing = true;
    this.startImg = $r('app.media.start');
  }

  reset() {
    clearInterval(this.timer);
    this.isRunning = false;
    this.isPausing = false;
    this.progressVal = 0;
    this.rotates = 0;
    this.passSec = 0;
    this.hoursTime = 0;
    this.minuteTime = 0;
    this.secondTime = 0;
    this.startImg = $r('app.media.start');
    this.resetImg = $r('app.media.resetccc');
  }

  build() {
    Column() {
      Column({ space: 20 }) {
        Clock({rotates: this.rotates, progressVal: this.progressVal})

        Text(FormatTime(this.hoursTime) + ':' + FormatTime(this.minuteTime) + ':' + FormatTime(this.secondTime))
          .id('countdownTime')
          .fontSize(20)
          .fontWeight(500)
          .fontColor($r('app.color.text_bg'))
          .fontFamily('HarmonyHeiTi-Medium')
        if (this.isRunning) {
          Blank()
            .height(180)
        } else {
          Time({pickerTime: (h: number, m: number, s: number) => {
            this.hoursTime = h;
            this.minuteTime = m;
            this.secondTime = s;
          }})
        }
        Row() {
          Image(this.resetImg)
            .id('reset')
            .width(48)
            .height(48)
            .margin({ right: 100 })
            .objectFit(ImageFit.Fill)
            .onClick(() => {
              this.reset()
            })

          Image(this.startImg)
            .id('start')
            .width(48)
            .height(48)
            .onClick(() => {
              if (this.hoursTime + this.minuteTime + this.secondTime === 0) {
                return;
              }
              if (!this.isRunning || this.isPausing) {
                this.start();
              } else {
                this.pause();
              }
            })
        }
      }
      .width('100%')
      .alignItems(HorizontalAlign.Center)
    }
  }
}

@Component
struct Clock {
  private settings: RenderingContextSettings = new RenderingContextSettings(true);
  private context: CanvasRenderingContext2D = new CanvasRenderingContext2D(this.settings);

  @Link rotates: number;
  @Link progressVal: number;

  build() {
    Stack() {
      Image($r('app.media.clock_bg_out'))
        .width(280)
        .height(280)

      Progress({ value: this.progressVal, style: ProgressStyle.ScaleRing })
        .width(250)
        .height(250)

      Canvas(this.context)
        .onReady(() => {
          this.context.lineWidth = 8;
          this.context.strokeStyle = '#f2400a';
          this.context.beginPath();
          this.context.moveTo(15, 0);
          this.context.stroke();
        })
        .id('countdownCanvas')
        .width(10)
        .height(250)
        .position({
          x: '48.5%',
          y: 15
        })
        .rotate({
          x: 0,
          y: 0,
          z: 1,
          angle: this.rotates,
          centerX: '50%',
          centerY: 125
        })
        .animation({
          curve: Curve.Linear
        })

      Image($r('app.media.seconds'))
        .width('25%')
        .height('92%')
        .objectFit(ImageFit.Contain)
        .rotate({ z: 1, angle: -this.rotates })
    }
    .margin({ top: 35 })
    .height(280)
  }
}

@ComponentV2
struct Time {
  @Local pickerH: number = 0;
  @Local pickerM: number = 0;
  @Local pickerS: number = 0;

  @Event pickerTime: (h: number, m: number, s: number) => void = (h: number, m: number, s: number) => {};

  pickerArrayGen(num: number) {
    return Array.from({ length: num }, (_: string, i) => (i < 10) ? ('0' + i) : ('' + i));
  }

  build() {
    Column({ space: 14 }) {
      Row() {
        TextPicker({ range: this.pickerArrayGen(24) })
          .width(60)
          .height('100%')
          .onChange((value: string | string[], index: number | number[]) => {
            this.pickerH = index as number;
            this.pickerTime(this.pickerH, this.pickerM, this.pickerS);
          })

        Text(':')
          .fontSize(24)
          .fontWeight(400)
          .fontFamily('HarmonyHeiTi')
          .margin({ left: 14, right: 14 })

        TextPicker({ range: this.pickerArrayGen(60) })
          .id('minute')
          .width(60)
          .height('100%')
          .onChange((value: string | string[], index: number | number[]) => {
            this.pickerM = index as number;
            this.pickerTime(this.pickerH, this.pickerM, this.pickerS);
          })

        Text(':')
          .fontSize(24)
          .fontWeight(400)
          .fontFamily('HarmonyHeiTi')
          .margin({ left: 15, right: 15 })

        TextPicker({ range: this.pickerArrayGen(60) })
          .width(60)
          .height('100%')
          .onChange((value: string | string[], index: number | number[]) => {
            this.pickerS = index as number;
            this.pickerTime(this.pickerH, this.pickerM, this.pickerS);
          })
      }
      .height(128)

      Row() {
        Text($r('app.string.hour'))
          .fontSize(14)
          .fontWeight(500)
          .fontColor($r('app.color.text_bg'))
          .fontFamily('HarmonyHeiTi')

        Text($r('app.string.minute'))
          .fontSize(14)
          .fontWeight(500)
          .fontColor($r('app.color.text_bg'))
          .fontFamily('HarmonyHeiTi')
          .margin({ left: 83, right: 83 })

        Text($r('app.string.seconds'))
          .fontSize(14)
          .fontWeight(500)
          .fontColor($r('app.color.text_bg'))
          .fontFamily('HarmonyHeiTi')
      }
    }
    .height('30%')
  }
}

function FormatTime(num: number) {
  if (num > 99 || num < 0) {
    return '**';
  }
  return (num < 10) ? ('0' + num).toString() : num.toString();
}