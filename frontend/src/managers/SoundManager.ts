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

  public async playError(): Promise<void> {
    await this.errorSound.play();
  }

  public async playConnect(): Promise<void> {
    await this.connectSound.play();
  }

  public async playMessage(): Promise<void> {
    await this.messageSound.play();
  }

  public async playSwitch(): Promise<void> {
    await this.switchSound.play();
  }

  public async playRing(): Promise<void> {
    await this.ringSound.play();
  }

  public async playSound(path: string): Promise<void> {
    const audio = new Audio(path);
    await audio.play();
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
