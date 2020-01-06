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
  fullPaths: string[],
  fullDuration: number,
  section: number,
  sswCommand: null | Object,
  cancelDisabled: Boolean,
}

export default class App extends Component<any, AppState> {
  readonly state = {
    entry: '',
    output: '',
    startTime: 0,
    audioUrl: undefined,
    audioProgress: 0,
    fullPaths: [],
    fullDuration: 0,
    section: 1,
    sswCommand: null,
    cancelDisabled: true,
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
    const { fullPaths, section, audioProgress } = this.state;
    return (
      <div className="audio-graph">
        
          <svg
            className="waveform"
            viewBox={`0 -1 ${6000 * section} 2`}
            preserveAspectRatio="none"
          >
            {fullPaths.map((path, index) => (
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
      fullPaths: [],
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
        command.vidio2Svg({ source: filePath })
        .on('start', (timestramp: number) => {
          this.setState({
            startTime: timestramp,
            cancelDisabled: false
          })
        })
        .on('getSection', (section: number) => {
          this.setState({
            section
          })
        })
        .on('getAudioData', (audioUrl: string, outputFullPath: string)=>{
          this.setState({
            audioUrl,
            output: outputFullPath
          })
        })
        .on('getSvg', (fullPaths: string[])=>{
          this.setState({
            fullPaths
          })
        })
        .on('end', (timestramp: number, fullPaths: string[]) => {
          this.setState({
            fullDuration: timestramp - this.state.startTime,
            cancelDisabled: true,
          })
        })
        this.setState({
          sswCommand: command
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
