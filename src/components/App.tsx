import React from 'react';
import ffmpeg from 'fluent-ffmpeg';
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

import './App.scss'

interface AppState {
  entry: string,
  output: string,
  duration: number
}

interface AppProps {
  p?: any
}

export default class App extends React.PureComponent<AppProps, AppState> {
  readonly state = {
    entry: '',
    output: '',
    duration: 0
  }

  private inputRef = React.createRef<HTMLInputElement>();

  videoToAudio = (filePath: string) => {
    // 素材位置
    const filePwd = filePath.slice(0, filePath.lastIndexOf('/'));
    const fileName = filePath.slice(filePath.lastIndexOf('/') + 1, filePath.lastIndexOf('.'));
    ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
      if (!err) {
        const audioType = metadata.streams.filter((item: any) => item.codec_type === 'audio')[0].codec_name;
        
        let startTime: number = 0;
        let endTime: number = 0;
        let extension: string = '';
        switch (audioType){
          case 'vorbis':
            extension = 'ogg';
            break;
          default:
            extension = audioType;
        }
        const outputPath = `${filePwd}/${fileName}-${Date.now()}.${extension}`;

        const command = ffmpeg()
        command.input(filePath)
        .noVideo().audioCodec('copy')
        .on('start', () => {
          startTime = Date.now();
          console.log('start-process:', startTime);
        })
        .on('error', function(err: any, stdout: any, stderr: any) {
          alert(`转化失败: ${err.message}`);
        })
        .on('end', () => {
          endTime = Date.now();
          console.log('end-process:', endTime);
          this.setState({
            output: outputPath,
            duration: (endTime - startTime)
          })
        }).output(outputPath).run()
      } else {
        alert('未找到音频流！');
      }
    })
  }

  changeSource = (evt: React.ChangeEvent <HTMLInputElement>) => {
      const { target } = evt;
      const files = (target as any).files as FileList;
      let file: any;
      if (files.length > 0) {
        this.setState({
          entry: '',
          output: '',
          duration: 0
        }, () => {
          file = files[0];
            console.log(file);
            // 素材路径
            const filePath: string = file.path as string;
            this.setState({
              entry: filePath
            }, () => {
              this.inputRef.current.value  = '';
            });
            this.videoToAudio(filePath);
        })
      } else {
        alert('上传视频失败')
      }
  }

  render() {
    const { entry, output, duration } = this.state
    return (
      <div>
        <div className="wrapper">
          <input ref={this.inputRef} type="file" name="waveform" onChange={this.changeSource} />
        </div>
          <div className="wrapper">
            输入文件：
            <input className="path" type="input" value={entry} readOnly />
          </div>
          <div className="wrapper">
            输出文件：
            <input className="path" type="input" value={output} readOnly />
          </div>
          <div className="wrapper">
            转化时间：
            <input className="path" type="input" value={duration} readOnly />
          </div>
      </div>
    );
  }
}
