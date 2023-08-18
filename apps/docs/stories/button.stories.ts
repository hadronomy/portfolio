import type { Meta, StoryObj } from '@storybook/react';

import { Button } from '@portofolio/ui/button';

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta = {
  title: 'ui/button',
  component: Button,
  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/react/configure/story-layout
    layout: 'centered',
  },
  argTypes: {
    disabled: {
      defaultValue: false,
      control: 'boolean',
    },
    variant: {
      defaultValue: 'default',
      options: [
        'default',
        'destructive',
        'outline',
        'secondary',
        'ghost',
        'link',
      ],
      control: 'select',
    },
    size: {
      defaultValue: 'default',
      options: ['default', 'sm', 'lg'],
      control: 'select',
    },
  },
  args: {
    children: 'Click me',
  },
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
  tags: ['autodocs'],
  // More on argTypes: https://storybook.js.org/docs/react/api/argtypes
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'Click me',
  },
};

export const Small: Story = {
  args: {
    size: 'sm',
    children: 'Click me',
  },
};