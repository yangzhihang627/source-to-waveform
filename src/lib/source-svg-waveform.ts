import ffmpeg from 'fluent-ffmpeg'
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
const ffprobePath = require('@ffprobe-installer/ffprobe').path
ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

import AudioSVGWaveform from './audio-svg-waveform'
const path = require('path')
const process = require('process')
const fs = require('fs')
const OUTPUT_DIR = path.resolve(process.cwd(), 'dist')
const EventEmitter = require('events').EventEmitter

interface Vidio2SvgProps {
  source: string
  minute?: number
}

export default class SourceSVGWaveform extends EventEmitter {
  filePath: string
  outputDirName: string
  minute: number
  count: number
  outputFullPath: string
  section: number
  cancelFlag: boolean
  ffCommand: object | null
  cancelCallback: Function | null
  audioUrl: string
  cancelDisabled: boolean
  svgDatas: string[]
  curRate: number

  constructor () {
    super()
    this.filePath = ''
    this.minute = 3
    this.count = 0
    this.outputDirName = ''
    this.outputFullPath = ''
    this.section = 1
    this.cancelFlag = false
    this.cancelCallback = null
    this.ffCommand = null
    this.audioUrl = ''
    this.cancelDisabled = true
    this.svgDatas = []
    this.curRate = 0
  }

  private delDir (path: string) {
    let files = []
    if(fs.existsSync(path)){
      files = fs.readdirSync(path)
      files.forEach((file: any) => {
        let curPath = path + "/" + file
        if(fs.statSync(curPath).isDirectory()){
          this.delDir(curPath) //递归删除文件夹
        } else {
          fs.unlinkSync(curPath) //删除文件
        }
      })
      fs.rmdirSync(path)
    }
  }

  vidio2Svg (props: Vidio2SvgProps) {
    this.reset()
    this.filePath = props.source
    props.minute && (this.minute = props.minute)
    const fileName: string = this.filePath.slice(this.filePath.lastIndexOf('/') + 1, this.filePath.lastIndexOf('.'))
    const startTime: number = Date.now() //开始计时
    this.outputDirName = `${OUTPUT_DIR}/${fileName}-${startTime}`
    fs.mkdirSync(this.outputDirName)
    ffmpeg.ffprobe(this.filePath, (err, metadata) => {
      this.emit('start', startTime)
      if (!err) {
        const audioMsg = metadata.streams.filter((item) => item.codec_type === 'audio')[0]
        const audioType: string = audioMsg.codec_name
        const audioDuration: any = audioMsg.duration
        let extension: string
        switch (audioType){
          case 'vorbis':
            extension = 'ogg'
            break
          default:
            extension = audioType
        }        
        this.outputFullPath = `${OUTPUT_DIR}/${fileName}-${startTime}.mp3`
        this.section = Math.ceil(audioDuration / (60 * this.minute)) //分割的总份数
        const command = ffmpeg()
        this.ffCommand = command
        this.cancelDisabled = false
        command.input(this.filePath).noVideo() // 生成整段音频
        .on('start', (command) => {
          console.log(`命令行: ${command}`)
        })
        .on('error', (err) => {
          console.log(`转化失败: "${err.message}"`)
        })
        .on('end', () => {
          this.audioUrl = `${fileName}-${startTime}.mp3`
          this.emit('getAudioData', this.audioUrl, this.outputFullPath)
        }).output(this.outputFullPath).run()
        this.splitAudio(fileName, extension, startTime) // 开始分割音频文件
      } else {
        console.log('未找到音频流！')
      }
    })
    return this
  }

  ass2srt (props: Vidio2SvgProps) {
    const assPath = props.source
    const fileName = path.parse(assPath).name
    const outputFullPath = `${OUTPUT_DIR}/${fileName}.srt`
    ffmpeg().input(assPath)
    .on('start', (command) => {
      console.log(`命令行: ${command}`)
    })
    .on('error', (err) => {
      console.log(`转化失败: "${err.message}"`)
    })
    .on('end', () => {
      this.audioUrl = `${fileName}.srt`
      this.emit('getAudioData', this.audioUrl, this.outputFullPath)
    }).output(outputFullPath).run()
    return this
  }

  transVideo (filePath: string) {
    const { dir, name } = path.parse(filePath)
    const imgPath = path.resolve(dir, 'black.png')
    const assPath = path.resolve(dir, '12345.ass')
    const outputPath = path.resolve(dir, `${name}_test.mp4`)

    ffmpeg.ffprobe(filePath, (err, metadata) => {
      const videoInfo = metadata.streams.find(item => item.codec_type === 'audio')
      const duration = Number(videoInfo.duration) || 1
      console.log(222, metadata)

      ffmpeg(filePath)
      // .noVideo()
      // .outputOptions([
      //   `-vf subtitles=${assPath}`,
      //   '-crf 50',
      //   '-preset superfast',
      //   // 此设置默认设置过高，导致播放器不能正常播放
      //   '-pix_fmt yuv420p',
      // ])
      // .addInput(imgPath)
      // .fps(25)
      // .size('700x350')
      // .loop(duration)
      // .autopad(true, 'black')
      .on('start', (command) => {
        this.emit('start', Date.now())
        console.log(`命令行: ${command}`)
      })
      .on('progress', (progress) => {
        console.log(`Processing: ${progress.percent}% done`)
      })
      .on('error', (err) => {
        console.log(`转化失败: "${err.message}"`)
      })
      .on('end', () => {
        this.emit('end', Date.now())
        this.emit('getAudioData', outputPath)
      })
      // .save(outputPath)
    })

    
    return this
  }

  video2PNG (filePath: string) {
    const fileName = path.parse(filePath).name
    const outputPath = `${OUTPUT_DIR}/${fileName}-${Date.now()}.png`
    ffmpeg(filePath)
    .complexFilter([
      '[0:a]aformat=channel_layouts=mono,showwavespic=s=4000x400:colors=#545454:scale=sqrt'
    ])
    .outputOptions([
      '-vframes 1'
    ])
    .on('start', (command) => {
      console.log(`命令行: ${command}`)
    })
    .on('error', (err) => {
      console.log(`转化失败: "${err.message}"`)
    })
    .on('end', () => {
      const image = new Image()  
      // image.crossOrigin = ''
      image.src = `file://${outputPath}`  
      image.onload = () => {
        this.emit('getAudioData', this.audioUrl, this.getBase64Image(image))
      }  
      
    }).save(outputPath)
    return this
  }

  getBase64Image(img: HTMLImageElement) {
    const canvas = document.createElement("canvas")  
    canvas.width = img.width  
    canvas.height = img.height  
    const ctx = canvas.getContext("2d")  
    ctx.drawImage(img, 0, 0, img.width, img.height)  
    const ext = img.src.substring(img.src.lastIndexOf(".")+1).toLowerCase()  
    const dataURL = canvas.toDataURL("image/"+ext)  
    return dataURL  
  }
  
  private splitAudio (fileName: string, extension: string, startTime: number) {
    const outputName = `${fileName}-${Date.now()}.${extension}`
    const outputUrl = `${fileName}-${startTime}/${outputName}`
    const outputPath = `${OUTPUT_DIR}/${outputUrl}`
    const unit = 60 * this.minute // 分割单位
    if (this.count >= this.section) { // 计数器小于长度时持续分割
      return
    }
    const command = ffmpeg()  // 开始分割每段音频
    command.input(this.filePath).noVideo().audioCodec('copy')
    .on('start', (command) => {
      console.log(`split命令行: ${command}`)
    })
    .on('error', (err) => {
      console.log(`转化失败: "${err.message}"`)
    })
    .on('end', () => {
      if (this.cancelFlag) { // 终止分割音频
        setTimeout(() => { // 因为有连环回掉延后重置
          this.reset()
          this.cancelCallback && this.cancelCallback()
        }, 1000)
        return
      }
      this.audio2Svg(outputUrl, this.count)
      this.count = this.count + 1
      this.splitAudio(fileName, extension, startTime)
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
    })
    trackWaveform.loadFromUrl().then(() => {
      const data: any = trackWaveform.getPath({
        index,
        minute: this.minute
      })
      const d: string = data.d
      const endTime: number = data.timestamp
      const duration: number = data.duration
      const baseIndex: number = data.baseIndex
      if (this.cancelFlag) { // 终止生成音频svg
        setTimeout(() => { // 因为有连环回掉延后重置
          this.reset()
          this.cancelCallback && this.cancelCallback()
        }, 1000)
        return
      }
      if (this.svgDatas.length < index + 1) {
        this.svgDatas.length = index + 1
      }
      this.svgDatas.splice(index, 1, d)
      this.curRate = duration / 60 / this.minute + this.curRate
      if (this.svgDatas.filter(Boolean).length === this.section) {
        this.delDir(this.outputDirName)
        this.cancelDisabled = true
        this.emit('end', endTime)
      }
      this.emit('getSvg', this.svgDatas, this.curRate, baseIndex)
    })
      
  }

  private reset = () => {
    this.svgDatas = []
    this.count = 0
    this.filePath = ''
    this.audioUrl = ''
    this.cancelDisabled = true
    this.ffCommand = null
    this.curRate = 0
  }

  cancel = (callback: Function) => {
    callback && (this.cancelCallback = callback)
    this.cancelFlag = true // 终止分割音频
    const command: any = this.ffCommand
    command.kill() // 终止生成整段音频
    this.delDir(this.outputDirName) // 删除分割音频的文件夹
    fs.unlinkSync(this.outputFullPath) // 删除整段音频
    return this
  }
}