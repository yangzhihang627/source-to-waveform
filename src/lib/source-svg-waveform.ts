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

interface Data {
  filePath: string,
  minute?: number,
  cancelCB?: Function
}

export default class SourceSVGWaveform  {
    filePath: string;
    outputDirName: string;
    minute: number;
    count: number;
    outputFullPath: string;
    section: number;
    cancelFlag: boolean;
    ffCommand: object | null;
    cancelCB: Function;
    audioUrl: string;
    cancelDisabled: boolean;
    fullPaths: string[];
    fullDuration: number;
    firstDuration: number;
    constructor (props: Data) {
        this.filePath = props.filePath;
        this.minute = props.minute || 3;
        this.count = 0;
        this.outputDirName = '';
        this.outputFullPath = '';
        this.section = 1;
        this.cancelFlag = false;
        this.cancelCB = props.cancelCB || (() => {});
        this.ffCommand = null;
        this.audioUrl = '';
        this.cancelDisabled = true;
        this.fullPaths = [];
        this.fullDuration = 0;
        this.firstDuration = 0;
    }

    private delDir = path => {
        let files = [];
        if(fs.existsSync(path)){
          files = fs.readdirSync(path);
          files.forEach((file, index) => {
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

    video2Audio = () => {
        // 素材位置
        const fileName: string = this.filePath.slice(this.filePath.lastIndexOf('/') + 1, this.filePath.lastIndexOf('.'));
        const startTime: number = Date.now(); //开始计时
        this.outputDirName = `${OUTPUT_DIR}/${fileName}-${startTime}`;
        fs.mkdirSync(this.outputDirName);
        ffmpeg.ffprobe(this.filePath, (err, metadata) => {
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
            const command = ffmpeg();
            this.section = Math.ceil(audioDuration / (60 * this.minute)), //分割的总份数
            this.ffCommand = command;
            this.cancelDisabled = false;
            command.input(this.filePath).noVideo().audioCodec('copy') // 生成整段音频
            .on('error', (err) => {
              console.log(`转化失败: "${err.message}"`);
            })
            .on('end', () => {
              this.audioUrl = `${fileName}-${startTime}.${extension}`
            }).output(this.outputFullPath).run();
            this.splitAudio(fileName, extension, startTime); // 开始分割音频文件
          } else {
            console.log('未找到音频流！');
          }
        })
      }
    
      private splitAudio = (fileName: string, extension: string, startTime: number) => {
        const outputName = `${fileName}-${Date.now()}.${extension}`;
        const outputUrl = `${fileName}-${startTime}/${outputName}`;
        const outputPath = `${OUTPUT_DIR}/${outputUrl}`;
        const unit = 60 * this.minute; // 分割单位
        if (this.count >= this.section) { // 计数器小于长度时持续分割
          console.log('音频分割完成');
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
              this.cancelCB();
            }, 1000);
            return;
          }
          this.audio2Svg(outputUrl, startTime);
          this.count = this.count + 1;
          this.splitAudio(fileName, extension, startTime);
        }).output(outputPath)
        .seek(unit * this.count)
        .duration(unit)
        .run()
      }
    
      audio2Svg = (outputUrl, startTime) => {
        const trackWaveform = new AudioSVGWaveform({
          sampleRate: 3000,
          url: outputUrl,
          buffer: null
        });
        trackWaveform.loadFromUrl().then(() => {
          const data: any = trackWaveform.getPath();
          const d: string = data.d;
          const endTime: number = data.timestamp;
    
          if (this.cancelFlag) { // 终止生成音频svg
            setTimeout(() => { // 因为有连环回掉延后重置
              this.cancelCB();
            }, 1000);
            return;
          }
          switch (this.count) {
            case this.section - 1: //全部svg生成时间
                this.fullDuration = endTime - startTime;
                this.cancelDisabled = true;
                this.delDir(this.outputDirName);
                break;
            case 0: // 第一段svg生成时间
                this.firstDuration = endTime - startTime
                break;
          }
          this.fullPaths.push(d)
          console.log(this.count, this.fullPaths)
        });
      }

      cancel = () => {
        this.cancelFlag = true; // 终止分割音频
        const command: any = this.ffCommand;
        command.kill(); // 终止生成整段音频
        this.delDir(this.outputDirName) // 删除分割音频的文件夹
        fs.unlinkSync(this.outputFullPath); // 删除整段音频
      }
}