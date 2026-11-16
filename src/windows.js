// Следит за окнами других программ, чтобы снег мог на них ложиться.
// Windows: маленький C# через PowerShell (без нативных модулей).
// Linux/X11: wmctrl, если установлен. На Wayland окон не видно — снег просто ложится на панель задач.

const { spawn, execFile } = require('child_process')

const PS_SCRIPT = `
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Wins {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr p);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out RECT r, int s);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int s);

  public static string List(uint skip) {
    var sb = new StringBuilder("[");
    EnumWindows(delegate (IntPtr h, IntPtr p) {
      if (!IsWindowVisible(h) || IsIconic(h) || GetWindowTextLength(h) == 0) return true;
      if ((GetWindowLong(h, -20) & 0x80) != 0) return true;
      uint pid;
      GetWindowThreadProcessId(h, out pid);
      if (pid == skip) return true;
      int cloaked = 0;
      DwmGetWindowAttribute(h, 14, out cloaked, 4);
      if (cloaked != 0) return true;
      RECT r;
      if (DwmGetWindowAttribute(h, 9, out r, 16) != 0) return true;
      if (r.R - r.L < 150 || r.B - r.T < 80) return true;
      if (sb.Length > 1) sb.Append(',');
      sb.AppendFormat("[{0},{1},{2},{3},{4}]", h.ToInt64(), r.L, r.T, r.R, r.B);
      return true;
    }, IntPtr.Zero);
    return sb.Append("]").ToString();
  }
}
"@
[Wins]::SetProcessDPIAware() | Out-Null
while ($true) {
  [Console]::Out.WriteLine([Wins]::List(__PID__))
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds 250
}
`

function watchWindows(scale, onChange) {
  if (process.platform === 'win32') return watchWin(scale, onChange)
  if (process.platform === 'linux' && !process.env.WAYLAND_DISPLAY) return watchX11(onChange)
  return () => {}
}

function watchWin(scale, onChange) {
  const script = PS_SCRIPT.replace('__PID__', String(process.pid))
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
    windowsHide: true
  })

  let buf = ''
  let last = ''
  ps.stdout.on('data', chunk => {
    buf += chunk.toString()
    const lines = buf.split(/\r?\n/)
    buf = lines.pop()
    const line = lines.pop()
    if (!line || line === last) return
    last = line
    try {
      const list = JSON.parse(line).map(([id, l, t, r, b]) => ({
        id: String(id),
        x: l / scale,
        y: t / scale,
        w: (r - l) / scale,
        h: (b - t) / scale
      }))
      onChange(list)
    } catch {}
  })
  ps.stderr.on('data', d => console.error('[windows]', d.toString()))

  return () => ps.kill()
}

function watchX11(onChange) {
  let last = ''
  const timer = setInterval(() => {
    execFile('wmctrl', ['-lG'], (err, out) => {
      if (err) return clearInterval(timer)
      if (out === last) return
      last = out
      const list = out.trim().split('\n').map(line => {
        const [id, desk, x, y, w, h] = line.split(/\s+/)
        return { id, desk, x: +x, y: +y, w: +w, h: +h }
      }).filter(w => w.desk !== '-1' && w.w > 150 && w.h > 80)
      // wmctrl отдаёт окна снизу вверх, а нам нужно сверху вниз
      onChange(list.reverse())
    })
  }, 300)
  return () => clearInterval(timer)
}

module.exports = { watchWindows }
