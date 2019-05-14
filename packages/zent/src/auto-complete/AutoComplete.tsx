/**
 * AutoComplete
 */
import * as React from 'react';
import { Component } from 'react';
import cn from 'classnames';
import * as keycode from 'keycode';
import isUndefined from 'lodash-es/isUndefined';

import memoize from '../utils/memorize-one';
import Input from '../input';
import Popover from '../popover';
import SelectMenu, { ISelectMenuItem } from '../select-menu';
import { Omit } from 'utility-types';

const { caselessMatchFilterOption } = SelectMenu;

export interface IAutoCompleteMenuObjectItem
  extends Omit<ISelectMenuItem, 'items'> {
  value: string;
  valueField?: string;
  textField?: string;
  contentField?: string;
  searchContent?: string;
}

export type IAutoCompleteMenuItem =
  | string
  | number
  | IAutoCompleteMenuObjectItem;

export interface IAutoCompleteProps {
  value?: unknown;
  initialValue?: any;
  placeholder?: string;
  data?: IAutoCompleteMenuItem[];
  items?: IAutoCompleteMenuItem[];
  onChange?: (value: string) => void;
  onSelect?: (value: string) => void;
  onSearch?: (searchText: string) => void;
  filterOption?: (
    searchText: string,
    menuItem: IAutoCompleteMenuObjectItem
  ) => boolean;
  valueFromOption?: boolean;
  className?: string;
  popupClassName?: string;
  width?: number | string;
  valueFromOptions?: boolean;
  valueField: string;
  contentField: string;
  textField: string;
  disabled?: boolean;
  children?: any;
}

export interface IAutoCompleteState {
  open: boolean;
  value: unknown;
  searchText: string;
}

export class AutoComplete extends Component<
  IAutoCompleteProps,
  IAutoCompleteState
> {
  static defaultProps = {
    prefix: 'zent',
    filterOption: caselessMatchFilterOption,
    valueFromOptions: false,
    valueField: 'value',
    contentField: 'content',
    textField: 'text',
  };

  blurHandlerPrevented = false;
  refMenuItemList = React.createRef<SelectMenu>();

  constructor(props) {
    super(props);

    this.state = {
      open: false,
      value: props.initialValue || props.value || null,
      searchText: '', // combo specific
    };
  }

  static getDerivedStateFromProps(
    props: IAutoCompleteProps,
    state: IAutoCompleteState
  ) {
    const { value } = props;
    return isUndefined(value) || state.value === value
      ? null
      : {
          value: props.value,
        };
  }

  onSearchTextChange = e => {
    const searchText = e.target.value;
    const value = this.props.valueFromOptions
      ? this.getSelectedValueFromSearchText(searchText)
      : searchText; //
    this.setState({
      searchText,
      value,
    });

    if (!this.state.open) {
      this.open();
    }

    this.props.onSearch && this.props.onSearch(searchText);
    this.props.onChange && this.props.onChange(value);
  };

  onSearchKeyDown = e => {
    switch (keycode(e)) {
      case 'esc':
        this.close();
        break;
      case 'tab':
        this.close();
        break;
      case 'down':
        e.preventDefault();
        if (this.state.open) {
          this.moveFocusIndexDown();
        }
        break;
      case 'up': {
        e.preventDefault();
        if (this.state.open) {
          this.moveFocusIndexUp();
        }
        break;
      }
      case 'enter': {
        if (this.state.open) {
          this.selectCurrentFocusIndex(e);
        }
        break;
      }
      default:
    }
  };

  onSearchBlur = () => {
    if (this.props.valueFromOptions) {
      setTimeout(() => {
        if (!this.blurHandlerPrevented) {
          // Try to match searchText to item value
          const { searchText, value } = this.state;
          const selectedValue = this.getSelectedValueFromSearchText(searchText);
          if (selectedValue) {
            if (selectedValue !== value) {
              this.props.onSelect && this.props.onSelect(selectedValue);
              this.props.onChange && this.props.onChange(selectedValue);
            }
          } else {
            this.props.onSelect && this.props.onSelect(null);
            this.props.onChange && this.props.onChange(null);
          }
        }
        this.blurHandlerPrevented = false;
      }, 100); // delay the blur event handler until the click handler is done
    }
  };

  getSelectedValueFromSearchText = searchText => {
    let selectedValue = null;
    this.getTransformedItemConfigsFromProps().some(item => {
      if (
        item.searchContent === searchText ||
        item.content === searchText ||
        item.value === searchText
      ) {
        selectedValue = item.value;
        return true;
      }
      return false;
    });
    return selectedValue;
  };

  onSelect = value => {
    this.blurHandlerPrevented = true; // ugly way to prevent blur handler
    this.setState({
      value,
    });

    this.props.onSelect && this.props.onSelect(value);
    this.props.onChange && this.props.onChange(value);

    this.close();
  };

  /** Helpers */
  /**
   * Convert passed in data to item config list.
   *
   * @param props
   * @returns {*}
   * @private
   */
  getTransformedItemConfigs = memoize(
    (
      valueField: string,
      textField: string,
      contentField: string,
      items?: IAutoCompleteMenuItem[],
      data?: IAutoCompleteMenuItem[]
    ): IAutoCompleteMenuObjectItem[] => {
      return (items || data || []).map(item => {
        if (typeof item === 'string' || typeof item === 'number') {
          return {
            value: item,
            content: item,
          };
        }

        if (typeof item === 'object') {
          return {
            ...item,
            value: item[valueField],
            content: item[contentField] || item[textField] || item[valueField],
          };
        }

        throw new Error('AutoComplete unresolvable option!');
      });
    }
  );

  getTransformedItemConfigsFromProps() {
    const { items, data, textField, valueField, contentField } = this.props;

    return this.getTransformedItemConfigs(
      valueField,
      textField,
      contentField,
      items,
      data
    );
  }

  /**
   * Get the display text of selected value, since the value and content might be different, and content might be node.
   *
   * Use item.searchContent prior to item.content prior to item.value
   *
   * @returns {*}
   * @private
   */
  getDisplayText = (): string => {
    const { value } = this.state;
    let displayValue = value || '';
    const item = this.getItemByValue(value);
    if (item) {
      if (typeof item.searchContent === 'string') {
        displayValue = item.searchContent;
      } else if (typeof item.content === 'string') {
        displayValue = item.content;
      }
    }
    return displayValue as string;
  };

  /** methods */

  open = () => {
    const newState = {
      open: true,
      searchText: this.getDisplayText() || '',
    };

    this.setState(newState);
  };

  close = () => {
    this.setState({
      open: false,
      // do not clear searchText so that it could be reused for other event handlers.
    });
  };

  togglePopoverOpen = () => {
    if (this.state.open) {
      this.close();
    } else {
      this.open();
    }
  };

  /** menu list delegates */

  /**
   * Iteration function to get the item whose value
   * equals to the passed-in value, recursively.
   *
   * @param items
   * @param value
   * @returns {*}
   * @private
   */
  iterateItems = (items, value) => {
    let result = null;
    (items || []).some(item => {
      if (item && item.value === value) {
        result = item;
        return true;
      }
      return false;
    });
    return result;
  };

  /**
   * Get the item whose value equals to the passed-in value, recursively.
   *
   * @param value
   * @private
   */
  getItemByValue = value =>
    this.iterateItems(this.getTransformedItemConfigsFromProps(), value);

  moveFocusIndexDown = () => {
    const menuList = this.refMenuItemList.current;
    if (menuList) {
      return menuList.moveFocusIndexDown();
    }
  };

  moveFocusIndexUp = () => {
    const menuList = this.refMenuItemList.current;

    if (menuList) {
      return menuList.moveFocusIndexUp();
    }
  };

  selectCurrentFocusIndex = e => {
    const menuList = this.refMenuItemList.current;

    if (menuList) {
      return menuList.selectCurrentFocusIndex(e);
    }
  };

  render() {
    const {
      width,
      placeholder,
      className,
      popupClassName,
      disabled,
    } = this.props;
    const { open, searchText } = this.state;
    const items = this.getTransformedItemConfigsFromProps();

    const prefixCls = 'zent-auto-complete';

    const displayValue = this.getDisplayText();

    return (
      <Popover
        display="inline-block"
        position={Popover.Position.AutoBottomLeft}
        visible={open}
        className={cn(prefixCls, popupClassName)}
        wrapperClassName={cn(prefixCls, className, { disabled })}
        onVisibleChange={this.togglePopoverOpen}
        width={width}
        cushion={4}
      >
        <Popover.Trigger.Click>
          <Input
            className={cn('btn', {
              active: open,
            })}
            value={(open ? searchText : displayValue) || ''}
            placeholder={placeholder}
            onChange={this.onSearchTextChange}
            onKeyDown={this.onSearchKeyDown}
            onBlur={this.onSearchBlur}
            disabled={disabled}
          />
        </Popover.Trigger.Click>
        <Popover.Content>
          <SelectMenu
            ref={this.refMenuItemList}
            items={items}
            value={this.state.value}
            searchText={this.state.searchText}
            onSelect={this.onSelect}
            filterOption={this.props.filterOption}
            onRequestClose={this.close}
          />
        </Popover.Content>
      </Popover>
    );
  }
}

export default AutoComplete;
