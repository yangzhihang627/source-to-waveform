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
      fullPath: '',
      diffPath: '',
      waveformDuration: 0,
      minute: 1,
      count: 0
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
        const audioMsg = metadata.streams.filter((item) => item.codec_type === 'audio')[0];
        const { codec_name: audioType, duration: audioDuration} = audioMsg;
        const length = Math.ceil(audioDuration/60);
        const startTime = Date.now();

        const command = ffmpeg(filePath)
        command.noVideo().audioCodec('copy')
        .on('error', function(err, stdout, stderr) {
          alert(`转化失败: "${err.message}"`);
        })
        .on('end', () => {
          // console.log('end', this.state.count)
          this.setState({
            videoDuration: (Date.now() - startTime)
          })
        });
        let extension;
        switch (audioType){
          case 'vorbis':
            extension = 'ogg';
            break;
          default:
            extension = audioType;
        }
        
        this._splitAudio(command, fileName, extension, length);
      } else {
        alert('未找到音频流！');
      }
    })
  }

  _splitAudio = (command, fileName, extension, length) => {
    const { minute, count } = this.state;
    const outputName = `${fileName}-${Date.now()}.${extension}`;
    const outputPath = `${OUTPUT_DIR}/${outputName}`;
    // console.log('.....',length)
    if (count < length) {
      // console.log(1234, 60 * count, 60* minute)
      command.output(outputPath)
      .seek(60 * count)
      .duration(60 * minute)
      this.setState({
        count: count + 1
      }, () => {
        this._splitAudio(command, fileName, extension, length);
      })
    } else {
      command.run();
    }
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
