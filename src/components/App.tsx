import './App.scss'
import React, { Component } from 'react';
import ffmpeg from 'fluent-ffmpeg';
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

import SourceSVGWaveform from '../lib/source-svg-waveform';

interface AppState {
  entry: string,
  output: string,
  startTime: number,
  audioUrl: string | undefined,
  audioProgress: any,
  svgDatas: string[],
  fullDuration: number,
  section: number,
  sswCommand: null | Object,
  cancelDisabled: Boolean,
  curRate: number,
  baseIndex: number,
}

export default class App extends Component<any, AppState> {
  readonly state = {
    entry: '',
    output: '',
    startTime: 0,
    audioUrl: undefined,
    audioProgress: 0,
    svgDatas: [],
    fullDuration: 0,
    section: 1,
    sswCommand: null,
    cancelDisabled: true,
    curRate: 0,
    baseIndex: 0,
  }

  private playerRef = React.createRef<HTMLAudioElement>();
  private inputRef = React.createRef<HTMLInputElement>();

  componentDidMount() {
    const player: HTMLAudioElement = this.playerRef.current;
    player.addEventListener('timeupdate', () => {
      const currentTime = player.currentTime;
      const duration = player.duration;
      this.setState({audioProgress: ((currentTime / duration) * 100).toPrecision(4)});
    });
  }

  _renderSVGWaveform() {
    const { svgDatas, audioProgress, curRate, baseIndex } = this.state;
    return (
      <div className="audio-graph" style={{
        width: `${Math.round(curRate * 200)}px`
      }}>
          <svg
            className="waveform"
            viewBox={`0 -100 ${Math.round(baseIndex * curRate)} 200`}
            preserveAspectRatio="none"
          >
            {svgDatas.map((path, index) => (
              <path className="waveform__path" d={path} key={index} />
            ))}
          </svg>
        <div className="audio-progress" style={{width: `${audioProgress}%`}}></div>
      </div>
    );
  }

  resetState = (callback?: Function) => {
    this.setState({ // 还原所有默认值
      entry: '',
      output: '',
      audioUrl: undefined,
      audioProgress: 0,
      svgDatas: [],
      fullDuration: 0,
      section: 1,
      sswCommand: null,
      cancelDisabled: true
    }, () => {
      if(callback) callback();
    })
  }

  changeSource = (evt: React.ChangeEvent) => {
    const { target } = evt;
    const files = (target as any).files;
    let file;
    if (files.length > 0) {
      this.resetState(() => {
        file = files[0];
        // 素材路径
        const filePath = file.path;
        this.setState({
          entry: filePath
        }, () => {
          this.inputRef.current.value = '';
        });
        const command = new SourceSVGWaveform()
        command.video2Pic(filePath)
        .on('start', (timestramp: number) => {
          this.setState({
            startTime: timestramp,
          })
        })
        .on('end', (timestramp: number) => {
          this.setState({
            fullDuration: timestramp - this.state.startTime,
          })
        })
      })
    } else {
      console.log('上传视频失败')
    }
  }

  handleCancel = () => {
    const { sswCommand } = this.state
    sswCommand.cancel(this.resetState.call(this)); // 终止生成整段音频
  }

  render() {
    const { 
      entry,
      output,
      audioUrl,
      fullDuration,
      cancelDisabled
     } = this.state
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
            生成时间：
            <input className="path" type="input" value={`${fullDuration}ms`} readOnly />
          </div>
          <audio
              className="player"
              ref={ this.playerRef }
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
