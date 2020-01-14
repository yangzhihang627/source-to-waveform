import ffmpeg from 'fluent-ffmpeg';
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

import AudioSVGWaveform from './audio-svg-waveform';
const path = require('path');
const process = require('process');
const fs = require('fs');
const OUTPUT_DIR = path.resolve(process.cwd(), 'dist');
const EventEmitter = require('events').EventEmitter;

interface Vidio2SvgProps {
  source: string;
  minute?: number;
}

export default class SourceSVGWaveform extends EventEmitter {
  filePath: string;
  outputDirName: string;
  minute: number;
  count: number;
  outputFullPath: string;
  section: number;
  cancelFlag: boolean;
  ffCommand: object | null;
  cancelCallback: Function | null;
  audioUrl: string;
  cancelDisabled: boolean;
  svgDatas: string[];
  curRate: number;

  constructor () {
    super()
    this.filePath = '';
    this.minute = 3;
    this.count = 0;
    this.outputDirName = '';
    this.outputFullPath = '';
    this.section = 1;
    this.cancelFlag = false;
    this.cancelCallback = null;
    this.ffCommand = null;
    this.audioUrl = '';
    this.cancelDisabled = true;
    this.svgDatas = [];
    this.curRate = 0;
  }

  private delDir (path: string) {
    let files = [];
    if(fs.existsSync(path)){
      files = fs.readdirSync(path);
      files.forEach((file: any) => {
        let curPath = path + "/" + file;
        if(fs.statSync(curPath).isDirectory()){
          this.delDir(curPath); //递归删除文件夹
        } else {
          fs.unlinkSync(curPath); //删除文件
        }
      });
      fs.rmdirSync(path);
    }
  }

  vidio2Svg (props: Vidio2SvgProps) {
    this.reset()
    this.filePath = props.source;
    props.minute && (this.minute = props.minute)
    const fileName: string = this.filePath.slice(this.filePath.lastIndexOf('/') + 1, this.filePath.lastIndexOf('.'));
    const startTime: number = Date.now(); //开始计时
    this.outputDirName = `${OUTPUT_DIR}/${fileName}-${startTime}`;
    fs.mkdirSync(this.outputDirName);
    ffmpeg.ffprobe(this.filePath, (err, metadata) => {
      this.emit('start', startTime)
      if (!err) {
        const audioMsg = metadata.streams.filter((item) => item.codec_type === 'audio')[0];
        const audioType: string = audioMsg.codec_name;
        const audioDuration: any = audioMsg.duration;
        let extension: string;
        switch (audioType){
          case 'vorbis':
            extension = 'ogg';
            break;
          default:
            extension = audioType;
        }        
        this.outputFullPath = `${OUTPUT_DIR}/${fileName}-${startTime}.${extension}`;
        this.section = Math.ceil(audioDuration / (60 * this.minute)); //分割的总份数
        const command = ffmpeg();
        this.ffCommand = command;
        this.cancelDisabled = false;
        command.input(this.filePath).noVideo().audioCodec('copy') // 生成整段音频
        .on('error', (err) => {
          console.log(`转化失败: "${err.message}"`);
        })
        .on('end', () => {
          this.audioUrl = `${fileName}-${startTime}.${extension}`
          this.emit('getAudioData', this.audioUrl, this.outputFullPath)
        }).output(this.outputFullPath).run();
        this.splitAudio(fileName, extension, startTime); // 开始分割音频文件
      } else {
        console.log('未找到音频流！');
      }
    })
    return this;
  }
  
  private splitAudio (fileName: string, extension: string, startTime: number) {
    const outputName = `${fileName}-${Date.now()}.${extension}`;
    const outputUrl = `${fileName}-${startTime}/${outputName}`;
    const outputPath = `${OUTPUT_DIR}/${outputUrl}`;
    const unit = 60 * this.minute; // 分割单位
    if (this.count >= this.section) { // 计数器小于长度时持续分割
      return;
    }
    const command = ffmpeg()  // 开始分割每段音频
    command.input(this.filePath).noVideo().audioCodec('copy')
    .on('error', (err) => {
      console.log(`转化失败: "${err.message}"`);
    })
    .on('end', () => {
      if (this.cancelFlag) { // 终止分割音频
        setTimeout(() => { // 因为有连环回掉延后重置
          this.reset();
          this.cancelCallback && this.cancelCallback();
        }, 1000);
        return;
      }
      this.audio2Svg(outputUrl, this.count);
      this.count = this.count + 1;
      this.splitAudio(fileName, extension, startTime);
    }).output(outputPath)
    .seek(unit * this.count)
    .duration(unit)
    .run()
  }
  
  private audio2Svg (outputUrl: string, index: number) {
    const trackWaveform = new AudioSVGWaveform({
      sampleRate: 3000,
      url: outputUrl,
      buffer: null
    });
    trackWaveform.loadFromUrl().then(() => {
      const data: any = trackWaveform.getPath({
        index,
        minute: this.minute
      });
      const d: string = data.d;
      const endTime: number = data.timestamp;
      const duration: number = data.duration;
      const baseIndex: number = data.baseIndex;
      if (this.cancelFlag) { // 终止生成音频svg
        setTimeout(() => { // 因为有连环回掉延后重置
          this.reset();
          this.cancelCallback && this.cancelCallback();
        }, 1000);
        return;
      }
      if (this.svgDatas.length < index + 1) {
        this.svgDatas.length = index + 1
      }
      this.svgDatas.splice(index, 1, d)
      this.curRate = duration / 60 / this.minute + this.curRate
      if (this.svgDatas.length === this.section) {
        this.delDir(this.outputDirName);
        this.cancelDisabled = true;
        this.emit('end', endTime)
      }
      this.emit('getSvg', this.svgDatas, this.curRate, baseIndex)
    });
      
  }

  private reset = () => {
    this.svgDatas = []
    this.count = 0;
    this.filePath = '';
    this.audioUrl = '';
    this.cancelDisabled = true;
    this.ffCommand = null;
    this.curRate = 0;
  }

  cancel = (callback: Function) => {
    callback && (this.cancelCallback = callback)
    this.cancelFlag = true; // 终止分割音频
    const command: any = this.ffCommand;
    command.kill(); // 终止生成整段音频
    this.delDir(this.outputDirName) // 删除分割音频的文件夹
    fs.unlinkSync(this.outputFullPath); // 删除整段音频
    return this;
  }
}