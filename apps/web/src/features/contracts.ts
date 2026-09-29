import type { FeatureInstance } from '@supadub/features';
import type { Screen, ViewState } from '../ui/screens';

export type ClientContext = {
  state: ViewState;
  show(screen: Screen, clearError?: boolean): void;
  refresh(): void;
  fail(error: unknown): void;
  confirm(): void;
  checkpoint(): () => boolean;
};

export interface ClientFeature extends FeatureInstance {
  action?(name: string): Promise<boolean> | boolean;
  click?(target: HTMLElement): Promise<boolean> | boolean;
  submit?(form: HTMLFormElement): Promise<boolean> | boolean;
}
