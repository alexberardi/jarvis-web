import React from "react";

const createIcon = (name: string) => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  Icon.displayName = name;
  return Icon;
};

export const Bot = createIcon("Bot");
export const ChevronDown = createIcon("ChevronDown");
export const ChevronRight = createIcon("ChevronRight");
export const Loader2 = createIcon("Loader2");
export const User = createIcon("User");
export const Send = createIcon("Send");
export const RotateCw = createIcon("RotateCw");
export const LogOut = createIcon("LogOut");
export const MessageSquare = createIcon("MessageSquare");
