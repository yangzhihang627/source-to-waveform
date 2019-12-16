import './App.scss'
import React, { Component } from 'react';
import ffmpeg from 'fluent-ffmpeg';
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

import AudioSVGWaveform from 'audio-waveform-svg-path';
const path = require('path');
const process = require('process');
const fs = require('fs');
const OUTPUT_DIR = path.resolve(process.cwd(), 'dist');

class App extends Component {
  constructor (props) {
    super(props)
    this.state = {
      entry: '',
      output: '',
      firstDuration: 0,
      audioUrl: undefined,
      audioProgress: 0,
      fullPaths: [],
      diffPath: '',
      fullDuration: 0,
      count: 0,
      section: 1,
      outputDirName: '',
      cancelFlag: false,
      ffCommand: null,
      cancelDisabled: true,
      minute: 3
    }
  }

  componentDidMount() {
    this.player.addEventListener('timeupdate', () => {
      const currentTime = this.player.currentTime;
      const duration = this.player.duration;
      this.setState({audioProgress: ((currentTime / duration) * 100).toPrecision(4)});
    });
  }

  delDir = path => {
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

  _renderSVGWaveform() {
    const { fullPaths, section, audioProgress } = this.state;
    const persent = 1/section * 100
    return (
      <div className="audio-graph">
        {fullPaths.map((path, index) => (
          <svg
            className="waveform"
            style={{width: `${persent}%`}}
            viewBox="0 -1 6000 2"
            preserveAspectRatio="none"
            key={index}
          >
            <g>
              <path className="waveform__path" d={path} />
            </g>
          </svg>
        ))}
        <div className="audio-progress" style={{width: `${audioProgress}%`}}></div>
      </div>
    );
  }

  video2Audio = (filePath) => {
    // 素材位置
    const fileName = filePath.slice(filePath.lastIndexOf('/') + 1, filePath.lastIndexOf('.'));
    const startTime = Date.now(); //开始计时
    const outputDirName = `${OUTPUT_DIR}/${fileName}-${startTime}`;
    fs.mkdirSync(outputDirName);
    this.setState({
      outputDirName
    })
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (!err) {
        const audioMsg = metadata.streams.filter((item) => item.codec_type === 'audio')[0];
        const { codec_name: audioType, duration: audioDuration} = audioMsg;
        let extension;
        switch (audioType){
          case 'vorbis':
            extension = 'ogg';
            break;
          default:
            extension = audioType;
        }        
        const outputFullPath = `${OUTPUT_DIR}/${fileName}-${startTime}.${extension}`;
        const command = ffmpeg();
        this.setState({
          output: outputFullPath,
          section: Math.ceil(audioDuration / (60 * this.state.minute)), //分割的总份数
          ffCommand: command,
          cancelDisabled: false
        }, () => {
          command.input(filePath).noVideo().audioCodec('copy') // 生成整段音频
          .on('error', (err) => {
            console.log(`转化失败: "${err.message}"`);
          })
          .on('end', () => {
            this.setState({
              audioUrl: `${fileName}-${startTime}.${extension}`
            })
          }).output(outputFullPath).run();
          this.splitAudio(filePath, fileName, extension, startTime); // 开始分割音频文件
        });
      } else {
        console.log('未找到音频流！');
      }
    })
  }

  splitAudio = (filePath, fileName, extension, startTime) => {
    const { minute, count, section } = this.state;
    const outputName = `${fileName}-${Date.now()}.${extension}`;
    const outputUrl = `${fileName}-${startTime}/${outputName}`;
    const outputPath = `${OUTPUT_DIR}/${outputUrl}`;
    const unit = 60 * minute; // 分割单位
    if (count >= section) { // 计数器小于长度时持续分割
      console.log('音频分割完成');
      return;
    }
    const command = ffmpeg()  // 开始分割每段音频
    command.input(filePath).noVideo().audioCodec('copy')
    .on('error', (err) => {
      console.log(`转化失败: "${err.message}"`);
    })
    .on('end', () => {
      if (this.state.cancelFlag) { // 终止分割音频
        setTimeout(() => { // 因为有连环回掉延后重置
          this.resetState();
        }, 1000);
        return;
      }
      this.audio2Svg(outputUrl, startTime);
      this.setState({
        count: count + 1
      }, () => {
        this.splitAudio(filePath, fileName, extension, startTime);
      })
    }).output(outputPath)
    .seek(unit * count)
    .duration(unit)
    .run()
  }

  audio2Svg = (outputUrl, startTime) => {
    const { count, fullPaths, section } = this.state
    const trackWaveform = new AudioSVGWaveform({
      sampleRate: 3000,
      url: outputUrl
    });
    trackWaveform.loadFromUrl().then(() => {
      const { outputDirName } = this.state
      const { d, timestamp: endTime } = trackWaveform.getPath();
      if (this.state.cancelFlag) { // 终止生成音频svg
        setTimeout(() => { // 因为有连环回掉延后重置
          this.resetState();
        }, 1000);
        return;
      }
      switch (count) {
        case section - 1: //全部svg生成时间
            this.setState({
              fullDuration: (endTime - startTime),
              cancelDisabled: true
            });
            this.delDir(outputDirName);
            break;
        case 0: // 第一段svg生成时间
            this.setState({
              firstDuration: (endTime - startTime)
            });
            break;
      }
      fullPaths.push(d)
      this.setState({
        fullPaths,
      })
    });
  }

  resetState = (cb) => {
    this.setState({ // 还原所有默认值
      entry: '',
      output: '',
      firstDuration: 0,
      audioUrl: undefined,
      audioProgress: 0,
      fullPaths: [],
      diffPath: '',
      fullDuration: 0,
      count: 0,
      section: 1,
      outputDirName: '',
      cancelFlag: false,
      ffCommand: null,
      cancelDisabled: true
    }, () => {
      if(cb) cb();
    })
  }

  changeSource = (evt) => {
    const { target: { files } } = evt;
    let file;
    if (files.length > 0) {
      this.resetState(() => {
        file = files[0];
        // 素材路径
        const filePath = file.path;
        this.setState({
          entry: filePath
        }, () => {
          this.inputRef.value = '';
        });
        this.video2Audio(filePath);
      })
    } else {
      console.log('上传视频失败')
    }
  }

  handleCancel = () => {
    const { output, ffCommand, outputDirName } = this.state
    this.setState({ // 终止分割音频
      cancelFlag: true
    })
    ffCommand.kill(); // 终止生成整段音频
    this.delDir(outputDirName) // 删除分割音频的文件夹
    fs.unlinkSync(output); // 删除整段音频
  }

  render() {
    const { 
      entry,
      output,
      firstDuration,
      audioUrl,
      fullDuration,
      cancelDisabled
     } = this.state
    return (
      <div>
        <div className="wrapper">
          <input ref={(inputRef) => {this.inputRef = inputRef}} type="file" name="waveform" onChange={this.changeSource} />
          <button onClick={this.handleCancel} disabled={cancelDisabled}>取消生成SVG</button>
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
            一段svg时间：
            <input className="path" type="input" value={`${firstDuration}ms`} readOnly />
          </div>
          <div className="wrapper">
            全部svg时间：
            <input className="path" type="input" value={`${fullDuration}ms`} readOnly />
          </div>
          <audio
              className="player"
              ref={component => { this.player = component; }}
              src={audioUrl}
              controls
          >
              You browser doesn't support <code>audio</code> element.
          </audio>
          <div className="waveforms">
            {this._renderSVGWaveform()}
          </div>
      </div>
    );
  }
}

export default App;
