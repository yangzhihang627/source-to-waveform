function parseArrayBufferResponse(response) {
    if (!response.ok) {
        throw new Error(`${response.status} (${response.statusText})`);
    }

    return response.arrayBuffer();
}

export default class AudioSVGWaveform {
    constructor({url, buffer, sampleRate}) {
        this.url = url || null;
        this.audioBuffer = buffer || null;
        this.context = new AudioContext({
            sampleRate: sampleRate || 3000     //[3000, 44100, 384000]
        });
        this.sampleCount = 30;
        this.wavePeak = 100;
    }

    _getPeaks(channelData, peaks, channelNumber) {
        this.duration = Math.round(this.audioBuffer.duration)
        const peaksCount = this.duration * this.sampleCount
        const sampleSize = this.audioBuffer.length / peaksCount;
        const sampleStep = ~~(sampleSize / 10) || 1;
        const mergedPeaks = Array.isArray(peaks) ? peaks : [];

        for (let peakNumber = 0; peakNumber < peaksCount; peakNumber++) {
            const start = ~~(peakNumber * sampleSize);
            const end = ~~(start + sampleSize);
            let min = ~~(channelData[0] * this.wavePeak);
            let max = ~~(channelData[0] * this.wavePeak);

            for (let sampleIndex = start; sampleIndex < end; sampleIndex += sampleStep) {
                const value = ~~(channelData[sampleIndex] * this.wavePeak);

                if (value > max) {
                    max = value;
                }
                if (value < min) {
                    min = value;
                }
            }

            if (channelNumber === 0 || max > mergedPeaks[2 * peakNumber]) {
                mergedPeaks[2 * peakNumber] = max;
            }

            if (channelNumber === 0 || min < mergedPeaks[2 * peakNumber + 1]) {
                mergedPeaks[2 * peakNumber + 1] = min;
            }
        }

        return mergedPeaks;
    }
    /**
     * @return {String} path of SVG path element
     */
    _svgPath(peaks, index, minute) {
        const totalPeaks = peaks.length;
        const baseIndex = minute * 60 * this.sampleCount
        const startIndex = baseIndex * index * 2
        let d = '';
        // "for" is used for faster iteration
        for (let peakNumber = startIndex; peakNumber < startIndex + totalPeaks; peakNumber++) {
            if (peakNumber % 2 === 0) {
                d += ` M${~~(peakNumber / 2)}, ${peaks.shift()}`;
            } else {
                d += ` L${~~(peakNumber / 2)}, ${peaks.shift()}`;
            }
        }
        return {
            d,
            timestamp: Date.now(), 
            duration: this.duration,
            baseIndex,
        };
    }

    async loadFromUrl() {
        if (!this.url) {
            return null;
        }

        const response = await fetch(this.url);
        const arrayBuffer = await parseArrayBufferResponse(response);

        this.audioBuffer = await this.context.decodeAudioData(arrayBuffer);

        return this.audioBuffer;
    }

    getPath(obj) {
        if (!this.audioBuffer) {
            console.log('No audio buffer to proccess');
            return null;
        }

        const numberOfChannels = this.audioBuffer.numberOfChannels;
        let channels = [];

        for (let channelNumber = 0; channelNumber < numberOfChannels; channelNumber++) {
            channels.push(this.audioBuffer.getChannelData(channelNumber));
        }

        if (typeof obj.channelsPreprocess === 'function') {
            channels = channels.reduce(obj.channelsPreprocess, []);
        }

        const peaks = channels.reduce(
            // change places of arguments in _getPeaks call
            (mergedPeaks, channelData, ...args) => this._getPeaks(channelData, mergedPeaks, ...args), []
        );

        return this._svgPath(peaks, obj.index, obj.minute);
    }
}

