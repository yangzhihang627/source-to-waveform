import '../assets/css/App.css';
import React, { Component } from 'react';
import ffmpeg from 'fluent-ffmpeg';
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

import AudioSVGWaveform from 'audio-waveform-svg-path';
const path = require('path');
const process = require('process');
const OUTPUT_DIR = path.resolve(process.cwd(), 'dist');

import './App.scss'

class App extends Component {
  constructor (props) {
    super(props)
    this.state = {
      entry: '',
      output: '',
      videoDuration: 0,
      audioUrl: '',
      audioProgress: 0,
      fullPath: '',
      diffPath: '',
      waveformDuration: 0
    }
  }

  componentDidMount() {
    if (this.state.audioUrl) {
      this.loadAudioFromUrl(this.state.audioUrl);
    }
    this.player.addEventListener('timeupdate', () => {
      const currentTime = this.player.currentTime;
      const duration = this.player.duration;
      this.setState({audioProgress: ((currentTime / duration) * 100).toPrecision(4)});
    });
  }

  audio2Svg = (url) => {
    if (!url) {
      return;
    }

    const trackWaveform = new AudioSVGWaveform({
      sampleRate: 3000,
      url
    });
    const startTime = Date.now();
    trackWaveform.loadFromUrl().then(() => {
      const {d, timestamp: endTime} = trackWaveform.getPath();

      this.setState({
        audioUrl: url,
        fullPath: d,
        waveformDuration: (endTime - startTime)
      });
    });
  }

  _renderSVGWaveform(paths) {
    const {audioProgress} = this.state;

    return (
        <div className="audio-graph">
            {paths.filter(Boolean).map((path, index) => (
                <svg
                    className={`waveform waveform_${index}`}
                    viewBox="0 -1 6000 2"
                    preserveAspectRatio="none"
                    key={index}
                >
                    <g>
                        <path className={`waveform__path waveform__path_${index}`} d={path} />
                    </g>
                </svg>
            ))}
            <div className="audio-progress" style={{width: `${audioProgress}%`}}></div>
        </div>
    );
  }

  video2Audio = (filePath) => {
    // 素材位置
    // const filePwd = filePath.slice(0, filePath.lastIndexOf('/'));
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
        const outputName = `${fileName}-${Date.now()}.${extension}`;
        const outputPath = `${OUTPUT_DIR}/${outputName}`;

        const command = ffmpeg()
        command.input(filePath)
        .noVideo().audioCodec('copy')
        .on('start', () => {
          startTime = Date.now();
          // console.log('start-process:', startTime);
        })
        .on('error', function(err, stdout, stderr) {
          alert(`转化失败: "${err.message}"`);
        })
        .on('end', () => {
          endTime = Date.now();
          // console.log('end-process:', endTime);
          this.setState({
            output: outputPath,
            videoDuration: (endTime - startTime)
          })
          this.audio2Svg(outputName);
        }).output(outputPath).run()
      } else {
        alert('未找到音频流！');
      }
    })
  }

  changeSource = (evt) => {
      const { target: { files } } = evt;
      let file;
      if (files.length > 0) {
        this.setState({
          entry: '',
          output: '',
          videoDuration: 0,
          audioUrl: '',
          audioProgress: 0,
          fullPath: '',
          diffPath: '',
          waveformDuration: 0,
        }, () => {
          file = files[0];
            // console.log(file);
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
      fullPath,
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
            分离音频时间：
            <input className="path" type="input" value={`${videoDuration}ms`} readOnly />
          </div>
          <div className="wrapper">
            生产数据时间：
            <input className="path" type="input" value={`${waveformDuration}ms`} readOnly />
          </div>
          <audio
              className="player"
              ref={component => { this.player = component; }}
              src={fullPath ? audioUrl : undefined}
              // autoPlay
              controls
          >
              You browser doesn't support <code>audio</code> element.
          </audio>
          <div className="waveforms">
            {this._renderSVGWaveform([fullPath])}
          </div>
      </div>
    );
  }
}

export default App;
