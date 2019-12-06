import '../assets/css/App.css';
import React, { Component } from 'react';
import util from 'util';
import ffmpeg from 'fluent-ffmpeg';
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

import './App.scss'

class App extends Component {
  constructor (props) {
    super(props)
    this.state = {
      entry: '',
      output: '',
      duration: 0
    }
    this.videoToAudio = this.videoToAudio.bind(this)
    this.changeSource = this.changeSource.bind(this)
  }

  videoToAudio (filePath) {
    // 素材位置
    const filePwd = filePath.slice(0, filePath.lastIndexOf('/'));
    const fileName = filePath.slice(filePath.lastIndexOf('/') + 1, filePath.lastIndexOf('.'));
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (!err) {
        const audioType = metadata.streams.filter((item) => item.codec_type === 'audio')[0].codec_name;
        
        let startTime, endTime, extension;
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
          console.log('start')
          startTime = Date.now();
        })
        .on('error', function(err, stdout, stderr) {
          alert('转化失败: ', err.message);
        })
        .on('end', () => {
          console.log('end')
          endTime = Date.now();
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

  changeSource (evt) {
      const { target } = evt;
      let file;
      const files = target.files;
      if (files.length > 0) {
        this.setState({
          entry: '',
          output: '',
          duration: 0
        }, () => {
          file = files[0];
            console.log(file);
            // 素材路径
            const filePath = file.path;
            this.setState({
              entry: filePath
            }, () => {
              this.ipt.value = '';
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
          <input ref={(ipt) => {this.ipt = ipt}} type="file" name="waveform" onChange={this.changeSource} />
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

export default App;
