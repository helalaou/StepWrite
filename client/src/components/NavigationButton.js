import React from 'react';
import { Box, Button, Tooltip } from '@mui/material';
import WestIcon from '@mui/icons-material/West';
import EastIcon from '@mui/icons-material/East';
import { playClickSound } from '../utils/soundUtils';

function NavigationButton({ 
  direction = 'left', 
  onClick, 
  tooltip,
  showAt = 'always' // 'always' or 'mobile'
}) {
  const isLeft = direction === 'left';
  
  const handleClick = (e) => {
    // Play click sound and then execute the original onClick handler
    playClickSound();
    if (onClick) onClick(e);
  };
  
  const containerStyles = {
    position: 'fixed',
    [isLeft ? 'left' : 'right']: { xs: '8px', md: showAt === 'mobile' ? '8px' : 0 },
    top: { xs: 'auto', md: '50%' },
    bottom: { xs: '8px', md: 'auto' },
    transform: { xs: 'none', md: showAt === 'mobile' ? 'none' : 'translateY(-50%)' },
    zIndex: 3,
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'background.paper',
    borderRadius: { 
      xs: '4px', 
      md: showAt === 'mobile' ? '4px' : isLeft ? '0 8px 8px 0' : '8px 0 0 8px'
    },
    boxShadow: 2,
    transition: 'all 0.3s ease',
    '&:hover': {
      transform: { 
        xs: `translateX(${isLeft ? '' : '-'}5px)`, 
        md: showAt === 'mobile' 
          ? `translateX(${isLeft ? '' : '-'}5px)`
          : `translateY(-50%) translateX(${isLeft ? '' : '-'}5px)` 
      },
      boxShadow: 4,
    },
    '@media (max-width: 1300px)': {
      [isLeft ? 'left' : 'right']: '8px',
      top: 'auto',
      bottom: '8px',
      transform: 'none',
      '&:hover': {
        transform: `translateX(${isLeft ? '' : '-'}5px)`,
      },
    }
  };

  const buttonStyles = {
    minWidth: { xs: '40px', lg: '65px' },
    width: { xs: '40px', lg: '65px' },
    height: { xs: '40px', lg: '65px' },
    borderRadius: { 
      xs: '4px', 
      md: showAt === 'mobile' ? '4px' : isLeft ? '0 8px 8px 0' : '8px 0 0 8px'
    },
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '@media (max-width: 1300px)': {
      borderRadius: '4px',
    }
  };

  const Icon = isLeft ? WestIcon : EastIcon;

  return (
    <Box sx={containerStyles}>
      <Tooltip title={tooltip} placement={isLeft ? "right" : "left"}>
        <Button
          variant="contained"
          onClick={handleClick}
          sx={buttonStyles}
        >
          <Icon sx={{ fontSize: { xs: '1.2rem', lg: '1.8rem' } }} />
        </Button>
      </Tooltip>
    </Box>
  );
}

export default NavigationButton; 