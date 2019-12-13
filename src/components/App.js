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
      videoDuration: 0,
      audioUrl: '',
      audioProgress: 0,
      fullPaths: [],
      diffPath: '',
      waveformDuration: 0,
      minute: 3,
      count: 0,
      section: 1
    }
  }

  // componentDidMount() {
  //   if (this.state.audioUrl) {
  //     this.loadAudioFromUrl(this.state.audioUrl);
  //   }
  //   this.player.addEventListener('timeupdate', () => {
  //     const currentTime = this.player.currentTime;
  //     const duration = this.player.duration;
  //     this.setState({audioProgress: ((currentTime / duration) * 100).toPrecision(4)});
  //   });
  // }

  audio2Svg = (url, startTime) => {
    const { count, fullPaths, section } = this.state
    const trackWaveform = new AudioSVGWaveform({
      sampleRate: 3000,
      url
    });
    trackWaveform.loadFromUrl().then(() => {
      const {d, timestamp: endTime} = trackWaveform.getPath();
      switch (count) {
        case 0: // 第一段svg生成时间
            this.setState({
              videoDuration: (endTime - startTime)
            });
            break;
        case section - 1: //全部svg生成时间
            this.setState({
              waveformDuration: (endTime - startTime)
            });
            break;

      }
      fullPaths.push(d)
      this.setState({
        // audioUrl: url,
        fullPaths,
      });
    });
  }

  _renderSVGWaveform() {
    const { fullPaths, section } = this.state;
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
            {/* <div className="audio-progress" style={{width: `${audioProgress}%`}}></div> */}
        </div>
    );
  }

  video2Audio = (filePath) => {
    // 素材位置
    const fileName = filePath.slice(filePath.lastIndexOf('/') + 1, filePath.lastIndexOf('.'));
    const startTime = Date.now(); //开始计时
    const outputDirName = `${fileName}-${startTime}`;
    fs.mkdirSync(`${OUTPUT_DIR}/${outputDirName}`);
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
        this.setState({
          section: Math.ceil(audioDuration / (60 * this.state.minute)) //分割的总份数
        }, () => {
          this._splitAudio(filePath, fileName, extension, startTime); // 开始分割音频文件
        });
      } else {
        alert('未找到音频流！');
      }
    })
  }

  _splitAudio = (filePath, fileName, extension, startTime) => {
    const { minute, count, section } = this.state;
    const outputName = `${fileName}-${Date.now()}.${extension}`;
    const outputUrl = `${fileName}-${startTime}/${outputName}`;
    const outputPath = `${OUTPUT_DIR}/${outputUrl}`;
    const unit = 60 * minute; // 分割单位
    if (count < section) { // 计数器小于长度时持续分割
      const command = ffmpeg()  // 开始ffmpeg设置及事件绑定
      command.input(filePath).noVideo().audioCodec('copy')
      .on('error', function(err, stdout, stderr) {
        alert(`转化失败: "${err.message}"`);
      })
      .on('end', () => {
        console.log('end12345')
        this.audio2Svg(outputUrl, startTime)
        this.setState({
          count: count + 1
        }, () => {
          this._splitAudio(filePath, fileName, extension, startTime);
        })
      }).output(outputPath)
      .seek(unit * count)
      .duration(unit)
      .run()
    }
  }

  changeSource = (evt) => {
      const { target: { files } } = evt;
      let file;
      if (files.length > 0) {
        this.setState({ // 重选时还原所有默认值
          entry: '',
          output: '',
          videoDuration: 0,
          audioUrl: '',
          audioProgress: 0,
          fullPaths: [],
          diffPath: '',
          waveformDuration: 0,
          count: 0,
          section: 1
        }, () => {
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
        alert('上传视频失败')
      }
  }

  render() {
    const { 
      entry,
      output,
      videoDuration,
      audioUrl,
      waveformDuration
     } = this.state
    return (
      <div>
        <div className="wrapper">
          <input ref={(inputRef) => {this.inputRef = inputRef}} type="file" name="waveform" onChange={this.changeSource} />
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
            <input className="path" type="input" value={`${videoDuration}ms`} readOnly />
          </div>
          <div className="wrapper">
            全部svg时间：
            <input className="path" type="input" value={`${waveformDuration}ms`} readOnly />
          </div>
          <audio
              className="player"
              ref={component => { this.player = component; }}
              // src={fullPaths.length !== 0 ? audioUrl : undefined}
              // autoPlay
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
