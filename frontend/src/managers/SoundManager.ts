export class SoundManager {
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private errorSound: HTMLAudioElement;
  private connectSound: HTMLAudioElement;
  private messageSound: HTMLAudioElement;
  private switchSound: HTMLAudioElement;
  private ringSound: HTMLAudioElement;

  constructor() {
    this.errorSound = new Audio("audios/error.mp3");
    this.connectSound = new Audio("audios/join.mp3");
    this.messageSound = new Audio("audios/message.mp3");
    this.switchSound = new Audio("audios/switch.mp3");
    this.ringSound = new Audio("audios/ring.mp3");
  }

  public playError(): Promise<void> {
    return this.errorSound.play();
  }

  public playConnect(): Promise<void> {
    return this.connectSound.play();
  }

  public playMessage(): Promise<void> {
    return this.messageSound.play();
  }

  public playSwitch(): Promise<void> {
    return this.switchSound.play();
  }

  public playRing(): Promise<void> {
    return this.ringSound.play();
  }

  public playSound(path: string): Promise<void> {
    const audio = new Audio(path);
    return audio.play();
  }

  public startMorseBeep(): void {
    if (!this.audioContext) {
      this.audioContext = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: AudioContext })
          .webkitAudioContext
      )();
    }

    if (!this.oscillator) {
      this.oscillator = this.audioContext.createOscillator();
      this.oscillator.type = "sine";
      this.oscillator.frequency.setValueAtTime(
        800,
        this.audioContext.currentTime,
      );

      const gainNode = this.audioContext.createGain();
      gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);

      this.oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      this.oscillator.start();
    }
  }

  public stopMorseBeep(): void {
    if (this.oscillator) {
      this.oscillator.stop();
      this.oscillator.disconnect();
      this.oscillator = null;
    }
  }

  public async cleanup(): Promise<void> {
    this.stopMorseBeep();
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }
}
